import { Metadata } from 'next';
import AddAvailabilityForm from './AddAvailabilityForm';
import AvailabilityTable from './AvailabilityTable';

export const metadata: Metadata = {
  title: 'Agent Availability',
  description: 'View and manage agent availability schedules',
};

export default function AvailabilityPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Agent Availability</h1>

        <div className="mb-6">
          <AddAvailabilityForm />
        </div>

        <AvailabilityTable />
      </div>
    </div>
  );
}