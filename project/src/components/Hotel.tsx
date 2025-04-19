// Hotel.tsx — Now showing accommodations and attractions using OpenTripMap API and fetching city name from Supabase

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const OTM_API_KEY = import.meta.env.VITE_OPENTRIPMAP_API_KEY;

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Custom marker icons
const hotelIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
});

const attractionIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', // Valid red marker icon
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
});

interface Place {
  xid: string;
  name: string;
  kinds: string;
  lat: number | null;
  lon: number | null;
}

export function Hotel() {
  const { cityId } = useParams(); // expects city ID
  const [hotels, setHotels] = useState<Place[]>([]);
  const [attractions, setAttractions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [cityCoordinates, setCityCoordinates] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch the city name from Supabase
        const { data: cityData, error: cityError } = await supabase
          .from('cities') // Replace 'cities' with your actual table name
          .select('name')
          .eq('id', cityId)
          .single();

        if (cityError || !cityData) {
          throw new Error('City not found in the database');
        }

        const fetchedCityName = cityData.name;
        setCityName(fetchedCityName);

        // Step 2: Get coordinates for the city
        const geoRes = await fetch(`https://api.opentripmap.com/0.1/en/places/geoname?name=${fetchedCityName}&apikey=${OTM_API_KEY}`);
        if (!geoRes.ok) throw new Error('Failed to fetch city location');
        const geoData = await geoRes.json();
        const { lat, lon } = geoData;
        setCityCoordinates({ lat, lon });

        // Step 3: Fetch hotels
        const cachedHotels = localStorage.getItem(`hotels_${cityId}`);
        if (cachedHotels) {
          setHotels(JSON.parse(cachedHotels));
        } else {
          await fetchHotels();
        }

        // Step 4: Fetch attractions
        const cachedAttractions = localStorage.getItem(`attractions_${cityId}`);
        if (cachedAttractions) {
          setAttractions(JSON.parse(cachedAttractions));
        } else {
          const attractionsRes = await fetch(
            `https://api.opentripmap.com/0.1/en/places/radius?radius=5000&lon=${lon}&lat=${lat}&kinds=interesting_places&limit=50&rate=2&format=json&apikey=${OTM_API_KEY}`
          );
          if (!attractionsRes.ok) throw new Error('Failed to fetch attractions');
          const attractionsData = await attractionsRes.json();
          const mappedAttractions = attractionsData.map((attraction: any) => ({
            xid: attraction.xid,
            name: attraction.name || 'Unnamed Attraction',
            kinds: attraction.kinds || 'Unknown',
            lat: attraction.point?.lat || null,
            lon: attraction.point?.lon || null,
          }));
          localStorage.setItem(`attractions_${cityId}`, JSON.stringify(mappedAttractions));
          setAttractions(mappedAttractions);
        }
      } catch (err: any) {
        console.error('Error fetching data:', err.message);
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cityId]);

  const fetchHotels = async (offset = 0, limit = 10) => {
    const hotelsRes = await fetch(
      `https://api.opentripmap.com/0.1/en/places/radius?radius=5000&lon=${cityCoordinates?.lon}&lat=${cityCoordinates?.lat}&kinds=accomodations&limit=${limit}&offset=${offset}&rate=2&format=json&apikey=${OTM_API_KEY}`
    );
    const hotelsData = await hotelsRes.json();
    const mappedHotels = hotelsData.map((hotel: any) => ({
      xid: hotel.xid,
      name: hotel.name || 'Unnamed Accommodation',
      kinds: hotel.kinds || 'Unknown',
      lat: hotel.point?.lat || null,
      lon: hotel.point?.lon || null,
    }));
    setHotels((prev) => [...prev, ...mappedHotels]);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">
        Accommodations and Attractions in {cityName || 'Loading...'}
      </h2>

      {loading && <p className="text-gray-500">Loading data...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {/* Legend */}
      {!loading && !error && (
        <div className="mb-4">
          <p className="text-gray-700">
            <span className="inline-flex items-center">
              <img
                src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png"
                alt="Blue Marker"
                className="w-4 h-6 mr-2"
              />
              Accommodations
            </span>
          </p>
          <p className="text-gray-700">
            <span className="inline-flex items-center">
              <img
                src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png"
                alt="Red Marker"
                className="w-4 h-6 mr-2"
              />
              Attractions
            </span>
          </p>
        </div>
      )}

      {!loading && !error && cityCoordinates && (
        <MapContainer
          center={[cityCoordinates.lat, cityCoordinates.lon]}
          zoom={13}
          style={{ height: '500px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* Hotels */}
          {hotels.map((hotel) => (
            hotel.lat && hotel.lon && (
              <Marker
                key={hotel.xid}
                position={[hotel.lat, hotel.lon]}
                icon={hotelIcon}
              >
                <Popup>
                  <strong>{hotel.name}</strong>
                  <br />
                  {hotel.kinds}
                  <br />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name)}, ${encodeURIComponent(cityName || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    View on Google Maps
                  </a>
                </Popup>
              </Marker>
            )
          ))}
          {/* Attractions */}
          {attractions.map((attraction) => (
            attraction.lat && attraction.lon && (
              <Marker
                key={attraction.xid}
                position={[attraction.lat, attraction.lon]}
                icon={attractionIcon} // Use the red marker icon for attractions
              >
                <Popup>
                  <strong>{attraction.name}</strong>
                  <br />
                  {attraction.kinds}
                  <br />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(attraction.name)}, ${encodeURIComponent(cityName || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    View on Google Maps
                  </a>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      )}
    </div>
  );
}
