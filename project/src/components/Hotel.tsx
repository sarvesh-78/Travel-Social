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

// Booking.com API Key
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY;

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

interface BookingHotel {
  id: string;
  name: string;
  address: string;
  price: string;
  rating: number;
  image: string;
}

const getDefaultDates = () => {
  const today = new Date();
  const arrivalDate = new Date(today);
  arrivalDate.setDate(today.getDate() + 1); // Tomorrow
  const departureDate = new Date(today);
  departureDate.setDate(today.getDate() + 2); // Day after tomorrow

  const formatDate = (date: Date) => date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  return {
    arrival_date: formatDate(arrivalDate),
    departure_date: formatDate(departureDate),
  };
};

export function Hotel() {
  const { cityId } = useParams(); // expects city ID
  const [hotels, setHotels] = useState<Place[]>([]);
  const [attractions, setAttractions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [cityCoordinates, setCityCoordinates] = useState<{ lat: number; lon: number } | null>(null);

  const [bookingHotels, setBookingHotels] = useState<BookingHotel[]>([]); // New state for Booking.com hotels
  const [bookingError, setBookingError] = useState<string | null>(null); // New state for Booking.com errors

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
        console.log('OpenTripMap Geo Response:', geoData); // Debugging log
        const { lat, lon } = geoData;

        if (!lat || !lon) {
          throw new Error('Failed to fetch valid city coordinates');
        }

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

        // Step 5: Fetch hotels from Booking.com API
        await fetchBookingHotels(fetchedCityName);
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

  
          // const cachedResponse = localStorage.getItem(`booking_hotels_${city}`);
          // if (cachedResponse) {
          //     const parsedResponse = JSON.parse(cachedResponse); // Parse the JSON string
          //     console.log(parsedResponse);
          //     setBookingHotels(JSON.parse(cachedResponse)); // Use cached data
          //     console.log('Using cached Booking.com response');
          //     return; // Exit function since data is already fetched
          // }

          // Step 1: Fetch destination code
  const fetchBookingHotels = async (city: string) => {
    try {
        // Step 1: Check for cached data in localStorage
        const cachedHotels = localStorage.getItem(`booking_hotels_${city}`);
        if (cachedHotels) {
            console.log('Using cached Booking.com hotels:', cachedHotels);
            setBookingHotels(JSON.parse(cachedHotels)); // Use cached data
            return; // Exit the function since we have cached data
        }

        // Step 2: Fetch destination code
        const destRes = await fetch(
            `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${city}`,
            {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'booking-com15.p.rapidapi.com',
                },
            }
        );
        if (!destRes.ok) throw new Error('Failed to fetch destination code');
        const destData = await destRes.json();
        const destId = destData.data[0]?.dest_id;

        if (!destId) throw new Error('No destination code found for the city');

        // Step 3: Fetch hotels using the destination code
        const { arrival_date, departure_date } = getDefaultDates();
        const hotelsRes = await fetch(
            `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels?dest_id=${destId}&search_type=CITY&adults=1&children_age=0%2C17&room_qty=1&page_number=1&units=metric&temperature_unit=c&languagecode=en-us&currency_code=INR&location=IN&arrival_date=${arrival_date}&departure_date=${departure_date}`,
            {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'booking-com15.p.rapidapi.com',
                },
            }
        );

        if (!hotelsRes.ok) throw new Error('Failed to fetch hotels');
        const hotelsData = await hotelsRes.json();
        console.log('Hotels API Response:', hotelsData.data.hotels); // Log full response for debugging

        // Step 4: Map the API response to the desired structure
        const mappedHotels = hotelsData.data.hotels.map((hotel: any) => ({
            id: hotel.hotel_id, // Correct ID mapping
            name: hotel.property?.name || 'Unnamed Hotel', // Safe access to `property.name`
            address: hotel.property?.wishlistName || 'Address not available', // Safe access to `property.wishlistName`
            price: hotel.property?.priceBreakdown?.grossPrice?.value
                ? `${hotel.property.priceBreakdown.grossPrice.value} ${hotel.property.priceBreakdown.grossPrice.currency ?? 'INR'}`
                : 'Price not available', // Use nullish coalescing for fallback currency
            rating: hotel.property?.reviewScore || 'No rating', // Safe access to `property.reviewScore`
            image: hotel.property?.photoUrls?.[0] || '', // Safe access to `photoUrls[0]`
        }));

        // Step 5: Save data to localStorage
        localStorage.setItem(`booking_hotels_${city}`, JSON.stringify(mappedHotels));
        console.log('Saved hotels to cache:', mappedHotels);

        // Step 6: Update the state with mapped hotels
        setBookingHotels(mappedHotels);
    } catch (err: any) {
        console.error('Error fetching Booking.com hotels:', err.message);
        setBookingHotels([]); // Reset hotels on error
        setBookingError(err.message || 'Failed to fetch Booking.com hotels');
    }
};
        
        

        


return (
  <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">
          Accommodations and Attractions in {cityName || 'Loading...'}
      </h2>

      {loading && <p className="text-gray-500">Loading data...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {/* Existing Map and Attractions */}
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
              {hotels.map((hotel) =>
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
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      hotel.name
                                  )}, ${encodeURIComponent(cityName || '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 underline"
                              >
                                  View on Google Maps
                              </a>
                          </Popup>
                      </Marker>
                  )
              )}
              {/* Attractions */}
              {attractions.map((attraction) =>
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
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      attraction.name
                                  )}, ${encodeURIComponent(cityName || '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 underline"
                              >
                                  View on Google Maps
                              </a>
                          </Popup>
                      </Marker>
                  )
              )}
          </MapContainer>
      )}

      {/* Booking.com Hotels */}
      {!loading && !error && (
          <div className="mt-8">
              <h3 className="text-3xl font-bold mb-6 text-gray-800">
                  Hotels from Booking.com
              </h3>
              {bookingError && (
                  <p className="text-red-600 text-center">{bookingError}</p>
              )}
              {bookingHotels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {bookingHotels.map((hotel) => (
                          <div
                              key={hotel.hotel_id || hotel.id || Math.random()}
                              className="hotel-card border border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-4 bg-white"
                          >
                              {/* Hotel Image */}
                              <div className="relative mb-4">
                                  <img
                                      src={hotel.image || 'https://via.placeholder.com/300x200'}
                                      alt={hotel.name || 'Unnamed Hotel'}
                                      className="w-full h-48 object-cover rounded-t-lg"
                                  />
                                  {!hotel.image && (
                                      <p className="absolute inset-0 flex items-center justify-center bg-gray-300 text-gray-700 text-sm">
                                          No Image Available
                                      </p>
                                  )}
                              </div>

                              {/* Hotel Details */}
                              <div className="text-center">
                                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                      {hotel.name || 'Unnamed Hotel'}
                                  </h4>
                                  <p className="text-gray-700 text-sm mb-2">
                                      <span className="font-bold">Rating: </span>
                                      {hotel.rating || 'No rating'}
                                  </p>
                                  <p className="text-green-600 text-base font-bold mb-2">
                                      {hotel.price || 'Price not available'}
                                  </p>
                                  <p className="text-gray-500 text-sm">
                                      {hotel.address || 'Address not available'}
                                  </p>
                              </div>

                              {/* Call to Action */}
                              <div className="mt-4">
                                  <button
                                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition duration-200"
                                      onClick={() =>
                                          window.open(
                                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                                  hotel.name
                                              )}`,
                                              '_blank'
                                          )
                                      }
                                  >
                                      View on Google Maps
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  !bookingError && (
                      <p className="text-gray-500 text-center">
                          No hotels found for the selected destination.
                      </p>
                  )
              )}
          </div>
      )}
  
      </div>
    );
}
