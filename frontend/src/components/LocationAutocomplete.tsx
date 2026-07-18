'use client';

import { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface LocationAutocompleteProps {
  id: string;
  placeholder: string;
  onPlaceSelected: (name: string, lat: number, lng: number) => void;
  disabled?: boolean;
}

// Wraps Google's PlaceAutocompleteElement (places library) so TripForm can
// resolve a typed address straight to a name + lat/lng pair, atomically —
// no separate manual coordinate entry. Uses the same importLibrary loader
// pattern as MapComponent.tsx (no new API key, no new loader setup).
export default function LocationAutocomplete({
  id,
  placeholder,
  onPlaceSelected,
  disabled,
}: LocationAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const container = containerRef.current;
    if (!apiKey || !container) return;

    setOptions({ key: apiKey, v: 'weekly' });

    let cancelled = false;
    let currentElement: google.maps.places.PlaceAutocompleteElement | null = null;
    let handleSelect: ((event: Event) => void) | null = null;

    // `@types/google.maps`'s PlacesLibrary destructure type omits
    // PlaceAutocompleteElement (it's only reachable via the global
    // google.maps.places namespace once the library has loaded), so we
    // import for the side effect and construct off the namespace instead.
    importLibrary('places').then(() => {
      if (cancelled) return;

      // Unlike other Maps classes, PlaceAutocompleteElement extends
      // HTMLElement (not MVCObject): its constructor takes an options
      // object (all fields optional) rather than nothing, and it exposes
      // the standard DOM addEventListener/removeEventListener pair rather
      // than addListener/MapsEventListener.
      const element = new google.maps.places.PlaceAutocompleteElement({});
      element.id = id;
      if (placeholder) {
        element.setAttribute('placeholder', placeholder);
      }
      container.appendChild(element);
      elementRef.current = element;
      currentElement = element;

      // `PlaceAutocompletePlaceSelectEvent`/`event.place` in `@types/google.maps`
      // describe the beta channel only (see the class's JSDoc). This app loads
      // the stable `v=weekly` runtime via setOptions above, whose actual
      // `gmp-select` event instead carries `event.placePrediction` (a
      // `PlacePrediction`, per Google's documented stable-channel pattern:
      // https://developers.google.com/maps/documentation/javascript/place-autocomplete-new).
      // `PlacePrediction.toPlace()` converts it to the `Place` we then call
      // `fetchFields` on. Typed as a bare `Event` with a cast below since no
      // exported type in this @types version models the stable event shape.
      handleSelect = ((event: Event) => {
        void (async () => {
          const { placePrediction } = event as unknown as {
            placePrediction: google.maps.places.PlacePrediction | null;
          };
          if (!placePrediction) return;
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ['displayName', 'location'] });
          if (!place.location) return;
          onPlaceSelected(
            place.displayName ?? placeholder,
            place.location.lat(),
            place.location.lng()
          );
        })();
      }) as (event: Event) => void;
      element.addEventListener('gmp-select', handleSelect);
    });

    return () => {
      cancelled = true;
      if (currentElement && handleSelect) {
        currentElement.removeEventListener('gmp-select', handleSelect);
      }
      if (elementRef.current && container.contains(elementRef.current)) {
        container.removeChild(elementRef.current);
      }
      elementRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPlaceSelected/placeholder intentionally not deps: element is created once per mount
  }, [id]);

  return (
    <div
      ref={containerRef}
      data-disabled={disabled}
      className="w-full [&>*]:w-full [&>*]:rounded-md [&>*]:border [&>*]:border-dusk/40 [&>*]:bg-parchment [&>*]:px-3 [&>*]:py-2 [&>*]:text-sm [&>*]:text-canopy"
    />
  );
}
