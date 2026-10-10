"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useNotifications } from "./notification-provider";
import { authFetch } from "@/lib/api-client";

type AddressFields = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type Coordinates = { latitude: number; longitude: number };
type SavedAddress = AddressFields & Coordinates & { id: string };

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: { center: { lat: number; lng: number }; zoom: number; mapTypeControl: boolean; streetViewControl: boolean }) => GoogleMap;
        Marker: new (options: { map: GoogleMap; position: { lat: number; lng: number } }) => GoogleMarker;
        places: {
          Autocomplete: new (input: HTMLInputElement, options: { fields: string[]; types: string[] }) => GoogleAutocomplete;
        };
      };
    };
  }
}

type GoogleMap = { setCenter: (location: { lat: number; lng: number }) => void; setZoom: (zoom: number) => void };
type GoogleMarker = { setPosition: (location: { lat: number; lng: number }) => void };
type GooglePlace = {
  address_components?: { long_name: string; short_name: string; types: string[] }[];
  geometry?: { location?: { lat: () => number; lng: () => number } };
  name?: string;
};
type GoogleAutocomplete = { addListener: (name: string, callback: () => void) => void; getPlace: () => GooglePlace };

const apiUrl = process.env.NEXT_PUBLIC_PRODUCTS_API_URL ?? "http://localhost:4000";
const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const emptyForm: AddressFields = { fullName: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "" };

function addressPart(place: GooglePlace, type: string) {
  return place.address_components?.find((part) => part.types.includes(type))?.long_name ?? "";
}

export function GoogleAddressForm({ onSaved }: { onSaved: (address: SavedAddress) => void }) {
  const notifications = useNotifications();
  const streetRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObject = useRef<GoogleMap | null>(null);
  const markerObject = useRef<GoogleMarker | null>(null);
  const [fields, setFields] = useState(emptyForm);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!mapsKey) return;
    const existing = document.getElementById("google-maps-places") as HTMLScriptElement | null;
    const ready = () => setMapsReady(Boolean(window.google?.maps?.places));
    if (window.google?.maps?.places) {
      ready();
      return;
    }
    const script = existing ?? document.createElement("script");
    script.id = "google-maps-places";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}&libraries=places&loading=async`;
    script.async = true;
    script.onload = ready;
    script.onerror = () => setMapsError("Google Maps could not load. You can still enter the address manually.");
    if (!existing) document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsReady || !streetRef.current) return;
    const autocomplete = new window.google!.maps.places.Autocomplete(streetRef.current, {
      fields: ["address_components", "geometry", "name"],
      types: ["address"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      const nextCoordinates = location ? { latitude: location.lat(), longitude: location.lng() } : null;
      setFields((current) => ({
        ...current,
        line1: [addressPart(place, "street_number"), addressPart(place, "route")].filter(Boolean).join(" ") || place.name || current.line1,
        city: addressPart(place, "locality") || addressPart(place, "postal_town") || addressPart(place, "administrative_area_level_2"),
        state: addressPart(place, "administrative_area_level_1"),
        postalCode: addressPart(place, "postal_code"),
        country: addressPart(place, "country"),
      }));
      setCoordinates(nextCoordinates);
      if (nextCoordinates && mapRef.current) {
        const point = { lat: nextCoordinates.latitude, lng: nextCoordinates.longitude };
        if (!mapObject.current) {
          mapObject.current = new window.google!.maps.Map(mapRef.current, {
            center: point,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
          });
          markerObject.current = new window.google!.maps.Marker({ map: mapObject.current, position: point });
        } else {
          mapObject.current.setCenter(point);
          mapObject.current.setZoom(15);
          markerObject.current?.setPosition(point);
        }
      }
    });
  }, [mapsReady]);

  function updateField(event: React.ChangeEvent<HTMLInputElement>) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await authFetch(`${apiUrl}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, ...coordinates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? "The address could not be saved.");
      onSaved(data.address);
      notifications.toast("address-saved");
      setFields(emptyForm);
      setCoordinates(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The address could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="address-form" onSubmit={saveAddress}>
      <p className="eyebrow">Delivery details</p>
      <h2>Add an address</h2>
      <p className="map-note">
        {mapsKey ? "Search for a location to fill in its postal details and preview the map." : "Add a restricted Google Maps browser key to enable live place suggestions and the map preview."}
      </p>
      {mapsError && <p className="form-error" role="status">{mapsError}</p>}
      <label>Full name<input name="fullName" autoComplete="name" required value={fields.fullName} onChange={updateField} /></label>
      <label>Search address<input ref={streetRef} autoComplete="off" placeholder="Start typing a street or place" /></label>
      <label>Street address<input name="line1" autoComplete="address-line1" required value={fields.line1} onChange={updateField} /></label>
      <label>Apartment, suite, etc. <span>(optional)</span><input name="line2" autoComplete="address-line2" value={fields.line2} onChange={updateField} /></label>
      <div className="address-row"><label>City<input name="city" autoComplete="address-level2" required value={fields.city} onChange={updateField} /></label><label>State / region<input name="state" autoComplete="address-level1" required value={fields.state} onChange={updateField} /></label></div>
      <div className="address-row"><label>ZIP / postal code<input name="postalCode" autoComplete="postal-code" required value={fields.postalCode} onChange={updateField} /></label><label>Country<input name="country" autoComplete="country-name" required value={fields.country} onChange={updateField} /></label></div>
      {mapsKey && <div className="address-map" ref={mapRef} role="img" aria-label="Map preview of the selected delivery address" />}
      {coordinates && <p className="map-coordinates">Location pinned: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark account-submit" type="submit" disabled={pending}>{pending ? "Saving…" : "Save address"}</button>
    </form>
  );
}
