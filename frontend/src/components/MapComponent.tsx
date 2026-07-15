'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TripPlan, DayPlan } from '@/types/trip';

interface MapComponentProps {
  tripPlan: TripPlan | null;
  dayPlans: DayPlan[];
}

declare global {
  interface Window {
    google: any;
  }
}

export default function MapComponent({
  tripPlan,
  dayPlans
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [directionsService, setDirectionsService] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [placesService, setPlacesService] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);
  const [currentDay, setCurrentDay] = useState<number>(1);

  useEffect(() => {
    // Load Google Maps API
    const loadGoogleMaps = () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      console.log('Loading Google Maps API with key:', apiKey ? 'Present' : 'Missing');
      
      if (!apiKey) {
        console.error('Google Maps API key is missing! Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file');
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        console.error('Failed to load Google Maps API script');
      };
      document.head.appendChild(script);
    };

    if (!window.google) {
      loadGoogleMaps();
    } else {
      initializeMap();
    }
  }, []);

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.7749, lng: -122.4194 }, // Default to San Francisco
      zoom: 10,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    const directionsServiceInstance = new window.google.maps.DirectionsService();
    const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: true
    });

    const placesServiceInstance = new window.google.maps.places.PlacesService(mapInstance);

    setMap(mapInstance);
    setDirectionsService(directionsServiceInstance);
    setDirectionsRenderer(directionsRendererInstance);
    setPlacesService(placesServiceInstance);
  };

  // Clear markers function
  const clearMarkers = useCallback(() => {
    markers.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    setMarkers([]);
  }, [markers]);

  const showBasicRoute = useCallback(() => {
    if (!directionsService || !directionsRenderer || !tripPlan) return;
    
    try {
      clearMarkers();
      
      const stops = tripPlan.stops;
      if (stops.length < 2) return;

      const origin = stops[0].location;
      const destination = stops[stops.length - 1].location;
      const waypoints = stops.slice(1, -1).map(stop => ({
        location: stop.location,
        stopover: true
      }));

      const request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
        optimizeWaypoints: false
      };

      directionsService.route(request, (result: any, status: any) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          addStopMarkers(stops);
        }
      });
    } catch (error) {
      console.error('Error showing basic route:', error);
    }
  }, [directionsService, directionsRenderer, tripPlan, clearMarkers]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !tripPlan) return;
    
    // If no day plans, show basic route
    if (dayPlans.length === 0) {
      console.log('No day plans, showing basic route');
      showBasicRoute();
      return;
    }

    const calculateRoute = async () => {
      try {
        // Clear existing markers first
        clearMarkers();
        
        const currentDayPlan = dayPlans.find(plan => plan.day === currentDay);
        if (!currentDayPlan) return;

        const stops = currentDayPlan.stops;
        if (stops.length < 2) return;

        const origin = stops[0].location;
        const destination = stops[stops.length - 1].location;
        const waypoints = stops.slice(1, -1).map(stop => ({
          location: stop.location,
          stopover: true
        }));

        const request = {
          origin: origin,
          destination: destination,
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.IMPERIAL,
          optimizeWaypoints: false // Keep stops in order
        };

        const result = await directionsService.route(request);
        directionsRenderer.setDirections(result);
        
        // Add custom markers for stops
        addStopMarkers(stops);
        
        // Find POIs along the route
        findPOIsAlongRoute(result, currentDayPlan);
      } catch (error) {
        console.error('Error calculating route:', error);
      }
    };

    calculateRoute();
  }, [tripPlan, dayPlans, currentDay, directionsService, directionsRenderer, clearMarkers]);

  const addStopMarkers = (stops: any[]) => {
    const newMarkers: any[] = [];
    
    stops.forEach((stop, index) => {
      // Use geocoding to get coordinates for the stop
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: stop.location }, (results: any[], status: any) => {
        if (status === window.google.maps.GeocoderStatus.OK && results[0]) {
          const position = results[0].geometry.location;
          
          let iconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
          let title = stop.name;
          
          if (stop.type === 'start') {
            iconUrl = 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
            title = `START: ${stop.name}`;
          } else if (stop.type === 'destination') {
            iconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
            title = `END: ${stop.name}`;
          } else {
            iconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
            title = `Stop ${index + 1}: ${stop.name}`;
          }

          const marker = new window.google.maps.Marker({
            position: position,
            map: map,
            title: title,
            icon: {
              url: iconUrl,
              scaledSize: new window.google.maps.Size(32, 32)
            }
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="p-2">
                <h3 class="font-semibold">${stop.name}</h3>
                <p class="text-sm text-gray-600">${stop.location}</p>
                <p class="text-sm text-blue-600">${stop.type.toUpperCase()}</p>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          newMarkers.push(marker);
          setMarkers(prev => [...prev, marker]);
        }
      });
    });
  };

  const findPOIsAlongRoute = useCallback((routeResult: any, dayPlan: DayPlan) => {
    if (!placesService || !routeResult || !map) {
      console.log('Missing required services for POI search:', { 
        placesService: !!placesService, 
        routeResult: !!routeResult, 
        map: !!map 
      });
      setIsLoadingPOIs(false);
      return;
    }

    setIsLoadingPOIs(true);
    const newMarkers: any[] = [];
    let completedSearches = 0;
    const totalSearches = dayPlan.attractions.length;

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log('POI search timeout - forcing completion');
      setIsLoadingPOIs(false);
    }, 15000); // 15 second timeout

    const checkCompletion = () => {
      completedSearches++;
      if (completedSearches >= totalSearches) {
        clearTimeout(timeoutId);
        setMarkers(prevMarkers => [...prevMarkers, ...newMarkers]);
        setIsLoadingPOIs(false);
        console.log('Total markers added:', newMarkers.length);
      }
    };

    // Get route bounds center
    const routeCenter = routeResult.routes[0].bounds.getCenter();
    console.log('Searching for POIs around:', routeCenter);

    // Search for attractions based on day plan
    dayPlan.attractions.forEach((attraction, index) => {
      const searchRequest = {
        location: routeCenter,
        radius: 50000,
        keyword: attraction.name
      };

      console.log('Making attraction search request:', searchRequest);

      try {
        placesService.nearbySearch(searchRequest, (results: any[], status: any) => {
          console.log('Attraction search status:', status, 'Results:', results?.length || 0);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            console.log('Found attractions:', results.map(r => r.name));
            results.slice(0, 2).forEach((place) => {
              const marker = new window.google.maps.Marker({
                position: place.geometry.location,
                map: map,
                title: place.name,
                icon: {
                  url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                  scaledSize: new window.google.maps.Size(32, 32)
                }
              });

              const infoWindow = new window.google.maps.InfoWindow({
                content: `
                  <div class="p-2">
                    <h3 class="font-semibold">${place.name}</h3>
                    <p class="text-sm text-gray-600">${place.vicinity}</p>
                    <p class="text-sm text-yellow-600">🎯 ${attraction.type} Attraction</p>
                    <p class="text-sm text-gray-500">${attraction.estimatedDuration}m • ${attraction.cost ? `$${attraction.cost}` : 'Free'}</p>
                  </div>
                `
              });

              marker.addListener('click', () => {
                infoWindow.open(map, marker);
              });

              newMarkers.push(marker);
            });
          }
          checkCompletion();
        });
      } catch (error) {
        console.error('Error searching for attractions:', error);
        checkCompletion();
      }
    });
  }, [placesService, map]);

  const handleDayChange = (day: number) => {
    setCurrentDay(day);
  };

  return (
    <div className="h-full">
      {/* Day Selector */}
      {dayPlans.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Show Day:</span>
            <div className="flex space-x-1">
              {dayPlans.map((dayPlan) => (
                <button
                  key={dayPlan.day}
                  onClick={() => handleDayChange(dayPlan.day)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    currentDay === dayPlan.day
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {dayPlan.day}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapRef} className="w-full h-96 lg:h-[600px]" />
      
      {/* Loading Indicator */}
      {isLoadingPOIs && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Finding attractions...</span>
          </div>
        </div>
      )}
    </div>
  );
} 