'use client';

interface TripInfoProps {
  route: any;
  pois: any[];
}

export default function TripInfo({ route, pois }: TripInfoProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDistance = (meters: number) => {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(1)} miles`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Trip Information
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Route Details */}
        <div>
          <h4 className="text-lg font-medium text-gray-700 mb-3">Route Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Distance:</span>
              <span className="font-medium">
                {route?.routes?.[0]?.legs?.[0]?.distance?.text || 'Calculating...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">
                {route?.routes?.[0]?.legs?.[0]?.duration?.text || 'Calculating...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Start:</span>
              <span className="font-medium">{route?.startPoint}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Destination:</span>
              <span className="font-medium">{route?.destination}</span>
            </div>
          </div>
        </div>

        {/* POIs Summary */}
        <div>
          <h4 className="text-lg font-medium text-gray-700 mb-3">Points of Interest</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Hiking Trails</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Campgrounds</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Hotels</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Hostels</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Motels</span>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                Click on markers on the map to see details about each location
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-md">
        <h4 className="text-sm font-semibold text-yellow-800 mb-2">Travel Tips:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Plan your stops at camping sites for overnight stays</li>
          <li>• Check weather conditions before your trip</li>
          <li>• Pack essential camping gear and supplies</li>
          <li>• Consider alternative routes for scenic views</li>
        </ul>
      </div>
    </div>
  );
} 