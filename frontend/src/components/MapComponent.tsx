'use client';

import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Trip, TripPlan } from '@/types/trip';

interface MapComponentProps {
  trip: Trip | null;
  plan: TripPlan | null;
}

// Muted, parchment-toned map styling so the Google basemap doesn't clash
// with the trail-log aesthetic around it.
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#e8dfc9' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a3f2f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f1ebdd' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#d9cead' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a9c2b4' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#dcd3ba' }] },
];

export default function MapComponent({ trip, plan }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const poiMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoadError('Map unavailable — missing Google Maps API key.');
      return;
    }

    setOptions({ key: apiKey, v: 'weekly' });

    let cancelled = false;
    importLibrary('maps')
      .then(({ Map }) => {
        if (cancelled || !mapRef.current) return;
        const instance = new Map(mapRef.current, {
          center: { lat: 39.8283, lng: -98.5795 }, // continental US
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: MAP_STYLE,
        });
        setMap(instance);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Map failed to load.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    let cancelled = false;
    importLibrary('routes').then(() => {
      if (cancelled) return;
      const renderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#c1592c',
          strokeWeight: 4,
          strokeOpacity: 0.85,
        },
      });
      setDirectionsRenderer(renderer);
    });

    return () => {
      cancelled = true;
    };
  }, [map]);

  useEffect(() => {
    if (!map || !directionsRenderer || !trip) return;
    if (trip.waypoints.length + 2 < 2) return;

    setRouteError(null);

    // Clear any POI markers from a previous render before drawing the new route.
    poiMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    poiMarkersRef.current = [];

    const directionsService = new google.maps.DirectionsService();

    const origin = { lat: trip.startLat, lng: trip.startLng };
    const destination = { lat: trip.endLat, lng: trip.endLng };

    const allStops = plan
      ? plan.dayPlans.flatMap((day) => day.stops)
      : trip.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng, name: null, category: null, funScore: null }));

    // When a plan exists, allStops includes the route's start/end points too
    // (MfpResult.stop_sequence always starts/ends with them) — drop the
    // first/last entries so they aren't passed as waypoints on top of
    // origin/destination.
    const middleStops = plan ? allStops.slice(1, -1) : allStops;

    const waypoints: google.maps.DirectionsWaypoint[] = middleStops.map((stop) => ({
      location: { lat: stop.lat, lng: stop.lng },
      stopover: true,
    }));

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false, // fixed order — the whole premise of Most-Fun Path
        travelMode: google.maps.TravelMode.DRIVING,
      },
      async (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);

          if (plan) {
            const { AdvancedMarkerElement, PinElement } = (await google.maps.importLibrary(
              'marker'
            )) as google.maps.MarkerLibrary;
            const poiStops = middleStops.filter((s) => s.name);
            poiMarkersRef.current = poiStops.map((stop) => {
              const pin = new PinElement({ background: '#c1592c', borderColor: '#1f2e23' });
              return new AdvancedMarkerElement({
                map,
                position: { lat: stop.lat, lng: stop.lng },
                title: stop.name ?? undefined,
                content: pin.element,
              });
            });
          }
        } else {
          setRouteError(
            'Could not find a driving route between these stops — check the coordinates.'
          );
        }
      }
    );
  }, [map, directionsRenderer, trip, plan]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-dusk/30">
      <div ref={mapRef} className="h-full w-full min-h-[420px]" />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-parchment-deep font-body text-sm text-canopy/70">
          {loadError}
        </div>
      )}
      {!trip && !loadError && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-canopy/80 to-transparent p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-parchment/90">
            Log your route to see it here
          </p>
        </div>
      )}
      {routeError && (
        <div className="absolute inset-x-3 top-3 rounded-md border border-trail-rust/40 bg-parchment px-3 py-2 text-sm text-trail-rust shadow-sm">
          {routeError}
        </div>
      )}
    </div>
  );
}
