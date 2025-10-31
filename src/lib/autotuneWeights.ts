// Adaptive Weight Tuning Engine for AI Predictions
// Automatically adjusts scoring weights based on historical success patterns

import { supabaseService } from '@/lib/supabaseClient';

export interface Weights {
  accept: number;
  speed: number;
  avail: number;
  cred: number;
  distance: number;
}

export interface PerformanceMetrics {
  acceptance_rate_7d: number;
  acceptance_rate_30d: number;
  speed_correlation: number;
  availability_accuracy: number;
  guardrail_skip_rate: number;
  avg_response_time: number;
}

const DEFAULT_WEIGHTS: Weights = {
  accept: parseFloat(process.env.AI_WEIGHT_ACCEPT || '0.4'),
  speed: parseFloat(process.env.AI_WEIGHT_SPEED || '0.3'),
  avail: parseFloat(process.env.AI_WEIGHT_AVAIL || '0.2'),
  cred: parseFloat(process.env.AI_WEIGHT_CRED || '0.1'),
  distance: parseFloat(process.env.AI_DISTANCE_WEIGHT || '0.0'),
};

// Exponential smoothing factor (0.1 = slow adaptation, 0.9 = fast adaptation)
const SMOOTHING_ALPHA = 0.3;

// Minimum feedback samples required for tuning
const MIN_FEEDBACK_SAMPLES = 10;

/**
 * Calculate rolling performance metrics from feedback data
 */
async function calculateMetrics(windowDays: number): Promise<PerformanceMetrics | null> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    // Get feedback data
    const { data: feedback, error } = await supabaseService
      .from('ai_feedback')
      .select('result, responded_in')
      .gte('created_at', since.toISOString());

    if (error || !feedback || feedback.length < MIN_FEEDBACK_SAMPLES) {
      return null;
    }

    const totalFeedback = feedback.length;
    const successCount = feedback.filter((f) => f.result === 'success').length;
    const responseTimes = feedback
      .filter((f) => f.responded_in !== null)
      .map((f) => f.responded_in as number);

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    // Speed correlation: success rate for fast responders (<300s)
    const fastResponders = feedback.filter(
      (f) => f.responded_in && f.responded_in < 300
    );
    const speedCorrelation =
      fastResponders.length > 0
        ? fastResponders.filter((f) => f.result === 'success').length /
          fastResponders.length
        : 0.5;

    // Availability accuracy: success rate (proxy for accurate availability matching)
    const availabilityAccuracy = successCount / totalFeedback;

    // Guardrail skip rate from audit (simplified - assume low if high success rate)
    const guardrailSkipRate = 1 - successCount / totalFeedback;

    return {
      acceptance_rate_7d: windowDays === 7 ? successCount / totalFeedback : 0,
      acceptance_rate_30d: windowDays === 30 ? successCount / totalFeedback : 0,
      speed_correlation: speedCorrelation,
      availability_accuracy: availabilityAccuracy,
      guardrail_skip_rate: guardrailSkipRate,
      avg_response_time: avgResponseTime,
    };
  } catch (error) {
    console.error('Failed to calculate metrics:', error);
    return null;
  }
}

/**
 * Apply exponential smoothing to weight adjustment
 */
function smoothWeight(oldWeight: number, targetWeight: number): number {
  return oldWeight + SMOOTHING_ALPHA * (targetWeight - oldWeight);
}

/**
 * Normalize weights to sum to 1.0
 */
function normalizeWeights(weights: Weights): Weights {
  const sum = weights.accept + weights.speed + weights.avail + weights.cred + weights.distance;
  if (sum === 0) return DEFAULT_WEIGHTS;
  
  return {
    accept: weights.accept / sum,
    speed: weights.speed / sum,
    avail: weights.avail / sum,
    cred: weights.cred / sum,
    distance: weights.distance / sum,
  };
}

/**
 * Calculate new weights based on performance metrics
 */
function calculateNewWeights(
  currentWeights: Weights,
  metrics: PerformanceMetrics
): Weights {
  // Determine target weights based on metric performance
  let targetWeights = { ...currentWeights };

  // If acceptance rate is high, maintain current accept weight
  // If low, increase it slightly
  if (metrics.acceptance_rate_30d < 0.5) {
    targetWeights.accept = Math.min(0.6, currentWeights.accept * 1.2);
  }

  // If speed correlation is strong, increase speed weight
  if (metrics.speed_correlation > 0.7) {
    targetWeights.speed = Math.min(0.4, currentWeights.speed * 1.15);
  } else if (metrics.speed_correlation < 0.4) {
    targetWeights.speed = Math.max(0.1, currentWeights.speed * 0.85);
  }

  // If availability accuracy is high, maintain/increase avail weight
  if (metrics.availability_accuracy > 0.7) {
    targetWeights.avail = Math.min(0.35, currentWeights.avail * 1.1);
  } else if (metrics.availability_accuracy < 0.5) {
    targetWeights.avail = Math.max(0.1, currentWeights.avail * 0.9);
  }

  // Apply exponential smoothing
  const smoothedWeights: Weights = {
    accept: smoothWeight(currentWeights.accept, targetWeights.accept),
    speed: smoothWeight(currentWeights.speed, targetWeights.speed),
    avail: smoothWeight(currentWeights.avail, targetWeights.avail),
    cred: currentWeights.cred, // Keep credentials weight stable
    distance: currentWeights.distance, // Keep distance weight stable (not used yet)
  };

  // Normalize to ensure sum = 1.0
  return normalizeWeights(smoothedWeights);
}

/**
 * Log weight recalibration to audit table
 */
async function logWeightAudit(
  oldWeights: Weights,
  newWeights: Weights,
  reason: string,
  successWindow: string,
  metrics?: PerformanceMetrics
): Promise<void> {
  try {
    await supabaseService.from('ai_weight_audit').insert({
      old_weights: oldWeights,
      new_weights: newWeights,
      reason,
      success_window: successWindow,
      metrics: metrics || null,
    });
  } catch (error) {
    console.error('Failed to log weight audit:', error);
  }
}

/**
 * Get current weights (from override, latest audit, or defaults)
 */
export async function getCurrentWeights(): Promise<Weights> {
  // Check for manual override
  const override = process.env.AI_WEIGHT_OVERRIDE;
  if (override) {
    try {
      const parsed = JSON.parse(override);
      return normalizeWeights(parsed);
    } catch {
      console.warn('Invalid AI_WEIGHT_OVERRIDE, using defaults');
    }
  }

  // Get latest weights from audit
  try {
    const { data, error } = await supabaseService
      .from('ai_weight_audit')
      .select('new_weights')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.new_weights) {
      return data.new_weights as Weights;
    }
  } catch (error) {
    console.error('Failed to fetch current weights:', error);
  }

  return DEFAULT_WEIGHTS;
}

/**
 * Main autotune function - calculates and applies new weights
 */
export async function autotuneWeights(): Promise<{
  success: boolean;
  oldWeights: Weights;
  newWeights: Weights;
  metrics?: PerformanceMetrics;
  reason: string;
}> {
  const enabled = process.env.AI_AUTOTUNE_ENABLED === '1';
  
  if (!enabled) {
    const currentWeights = await getCurrentWeights();
    return {
      success: false,
      oldWeights: currentWeights,
      newWeights: currentWeights,
      reason: 'autotune_disabled',
    };
  }

  try {
    const currentWeights = await getCurrentWeights();

    // Calculate 30-day metrics
    const metrics = await calculateMetrics(30);

    if (!metrics) {
      return {
        success: false,
        oldWeights: currentWeights,
        newWeights: currentWeights,
        reason: 'insufficient_data',
      };
    }

    // Calculate new weights
    const newWeights = calculateNewWeights(currentWeights, metrics);

    // Check if weights actually changed (avoid noise)
    const weightsChanged =
      Math.abs(newWeights.accept - currentWeights.accept) > 0.01 ||
      Math.abs(newWeights.speed - currentWeights.speed) > 0.01 ||
      Math.abs(newWeights.avail - currentWeights.avail) > 0.01;

    if (!weightsChanged) {
      return {
        success: false,
        oldWeights: currentWeights,
        newWeights: currentWeights,
        metrics,
        reason: 'no_change',
      };
    }

    // Log the recalibration
    await logWeightAudit(currentWeights, newWeights, 'auto_tune', '30d', metrics);

    return {
      success: true,
      oldWeights: currentWeights,
      newWeights,
      metrics,
      reason: 'auto_tune',
    };
  } catch (error) {
    console.error('Autotune failed:', error);
    const fallbackWeights = await getCurrentWeights();
    return {
      success: false,
      oldWeights: fallbackWeights,
      newWeights: fallbackWeights,
      reason: 'error',
    };
  }
}
