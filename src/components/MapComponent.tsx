'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface MapComponentProps {
  startPoint: string;
  destination: string;
  route: any;
  pois: any[];
}

declare global {
  interface Window {
    google: any;
  }
}

export default function MapComponent({
  startPoint,
  destination,
  route,
  pois
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [directionsService, setDirectionsService] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [placesService, setPlacesService] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);

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

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !startPoint || !destination) return;

    const calculateRoute = async () => {
      try {
        // Clear existing markers first
        clearMarkers();
        
        const request = {
          origin: startPoint,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.IMPERIAL
        };

        const result = await directionsService.route(request);
        directionsRenderer.setDirections(result);
        
        // Find POIs along the route
        findPOIsAlongRoute(result);
      } catch (error) {
        console.error('Error calculating route:', error);
      }
    };

    calculateRoute();
  }, [startPoint, destination, directionsService, directionsRenderer, clearMarkers]);

  const findPOIsAlongRoute = useCallback((routeResult: any) => {
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
    const totalSearches = 5; // hikes, campgrounds, hotels, hostels, motels

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

    // Search for hiking trails
    const hikingRequest = {
      location: routeCenter,
      radius: 50000,
      keyword: 'hiking trail mountain trail'
    };

    console.log('Making hiking search request:', hikingRequest);

    try {
      placesService.nearbySearch(hikingRequest, (results: any[], status: any) => {
        console.log('Hiking search status:', status, 'Results:', results?.length || 0);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('Found hiking trails:', results.map(r => r.name));
          results.forEach((place, index) => {
            const marker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: new window.google.maps.Size(32, 32)
              }
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <h3 class="font-semibold">${place.name}</h3>
                  <p class="text-sm text-gray-600">${place.vicinity}</p>
                  <p class="text-sm text-blue-600">🥾 Hiking Trail</p>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            newMarkers.push(marker);
          });
        } else {
          console.log('Hiking search failed or no results:', status);
        }
        checkCompletion();
      });
    } catch (error) {
      console.error('Error in hiking search:', error);
      checkCompletion();
    }

    // Search for campgrounds
    const campingRequest = {
      location: routeCenter,
      radius: 50000,
      type: ['campground'],
      keyword: 'camping'
    };

    console.log('Making camping search request:', campingRequest);

    try {
      placesService.nearbySearch(campingRequest, (results: any[], status: any) => {
        console.log('Camping search status:', status, 'Results:', results?.length || 0);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('Found campgrounds:', results.map(r => r.name));
          results.forEach((place, index) => {
            const marker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                scaledSize: new window.google.maps.Size(32, 32)
              }
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <h3 class="font-semibold">${place.name}</h3>
                  <p class="text-sm text-gray-600">${place.vicinity}</p>
                  <p class="text-sm text-green-600">🏕️ Campground</p>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            newMarkers.push(marker);
          });
        } else {
          console.log('Camping search failed or no results:', status);
        }
        checkCompletion();
      });
    } catch (error) {
      console.error('Error in camping search:', error);
      checkCompletion();
    }

    // Search for hotels
    const hotelRequest = {
      location: routeCenter,
      radius: 50000,
      type: ['lodging'],
      keyword: 'hotel'
    };

    console.log('Making hotel search request:', hotelRequest);

    try {
      placesService.nearbySearch(hotelRequest, (results: any[], status: any) => {
        console.log('Hotel search status:', status, 'Results:', results?.length || 0);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('Found hotels:', results.map(r => r.name));
          results.forEach((place, index) => {
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
                  <p class="text-sm text-yellow-600">🏨 Hotel</p>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            newMarkers.push(marker);
          });
        } else {
          console.log('Hotel search failed or no results:', status);
        }
        checkCompletion();
      });
    } catch (error) {
      console.error('Error in hotel search:', error);
      checkCompletion();
    }

    // Search for hostels
    const hostelRequest = {
      location: routeCenter,
      radius: 50000,
      keyword: 'hostel'
    };

    console.log('Making hostel search request:', hostelRequest);

    try {
      placesService.nearbySearch(hostelRequest, (results: any[], status: any) => {
        console.log('Hostel search status:', status, 'Results:', results?.length || 0);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('Found hostels:', results.map(r => r.name));
          results.forEach((place, index) => {
            const marker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
                scaledSize: new window.google.maps.Size(32, 32)
              }
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <h3 class="font-semibold">${place.name}</h3>
                  <p class="text-sm text-gray-600">${place.vicinity}</p>
                  <p class="text-sm text-orange-600">🏠 Hostel</p>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            newMarkers.push(marker);
          });
        } else {
          console.log('Hostel search failed or no results:', status);
        }
        checkCompletion();
      });
    } catch (error) {
      console.error('Error in hostel search:', error);
      checkCompletion();
    }

    // Search for motels
    const motelRequest = {
      location: routeCenter,
      radius: 50000,
      keyword: 'motel'
    };

    console.log('Making motel search request:', motelRequest);

    try {
      placesService.nearbySearch(motelRequest, (results: any[], status: any) => {
        console.log('Motel search status:', status, 'Results:', results?.length || 0);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('Found motels:', results.map(r => r.name));
          results.forEach((place, index) => {
            const marker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png',
                scaledSize: new window.google.maps.Size(32, 32)
              }
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div class="p-2">
                  <h3 class="font-semibold">${place.name}</h3>
                  <p class="text-sm text-gray-600">${place.vicinity}</p>
                  <p class="text-sm text-purple-600">🚗 Motel</p>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            newMarkers.push(marker);
          });
        } else {
          console.log('Motel search failed or no results:', status);
        }
        checkCompletion();
      });
    } catch (error) {
      console.error('Error in motel search:', error);
      checkCompletion();
    }
  }, [placesService, map]);

  return (
    <div className="relative">
      <div 
        ref={mapRef} 
        className="w-full h-96 md:h-[500px] lg:h-[600px]"
      />
      
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-600 mb-2">Google Maps API Key Required</p>
            <p className="text-sm text-gray-500">
              Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file
            </p>
          </div>
        </div>
      )}

      {isLoadingPOIs && (
        <div className="absolute top-4 right-4 bg-white px-3 py-2 rounded-md shadow-md">
          <p className="text-sm text-gray-600">Finding points of interest...</p>
        </div>
      )}
    </div>
  );
} 