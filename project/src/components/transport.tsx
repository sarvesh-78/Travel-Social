import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../lib/supabase';

// Predefined city-to-IATA mapping
const cityToIataMap: Record<string, string> = {
  Chennai: 'MAA',
  Delhi: 'DEL',
  Mumbai: 'BOM',
  Bangalore: 'BLR',
  Kolkata: 'CCU',
  Hyderabad: 'HYD', // Example addition
  Ahmedabad: 'AMD', // Example addition
};

const Transport = () => {
  const { cityId } = useParams<{ cityId: string }>(); // Get city ID from the URL
  const [originCity, setOriginCity] = useState(''); // User input for origin city
  const [destinationCity, setDestinationCity] = useState(''); // Fetched destination city name
  const [originIata, setOriginIata] = useState(''); // Resolved IATA for origin city
  const [destinationIata, setDestinationIata] = useState(''); // Resolved IATA for destination city
  const [departureDate, setDepartureDate] = useState(''); // User input for departure date
  const [flights, setFlights] = useState([]);
  const [error, setError] = useState('');
  const exchangeRate = 82; // Example exchange rate: 1 USD = 82 INR

  // Fetch destination city name based on cityId
  useEffect(() => {
    const fetchDestinationCity = async () => {
      if (!cityId) {
        setError('City ID is missing in the URL.');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('cities') // Ensure you have a 'cities' table
          .select('name')
          .eq('id', cityId)
          .single();

        if (error) throw error;

        const fetchedCityName = data.name;
        setDestinationCity(fetchedCityName);

        const iataCode = cityToIataMap[fetchedCityName]; // Map city name to IATA code
        if (iataCode) {
          setDestinationIata(iataCode);
        } else {
          setError(`IATA code not found for the city "${fetchedCityName}".`);
        }
      } catch (err) {
        console.error('Error fetching destination city from Supabase:', err);
        setError('Failed to fetch destination city. Please try again later.');
      }
    };

    fetchDestinationCity();
  }, [cityId]);

  // Update origin IATA code when origin city is entered
  useEffect(() => {
    if (originCity) {
      const formattedCity = originCity.trim().toLowerCase(); // Convert the entire input to lowercase
      const properFormattedCity =
        formattedCity.charAt(0).toUpperCase() + formattedCity.slice(1); // Capitalize the first letter
      const iataCode = cityToIataMap[properFormattedCity]; // Match with the mapping
      if (iataCode) {
        setOriginIata(iataCode); // Set IATA code
        setError(''); // Clear any previous error
      } else {
        console.error(`IATA code not found for the city "${properFormattedCity}".`);
        setError(`IATA code not found for the city "${properFormattedCity}".`);
      }
    }
  }, [originCity]);

  const searchFlights = async () => {
    const cacheKey = `${originIata}-${destinationIata}-${departureDate}`;
    const cachedData = JSON.parse(localStorage.getItem(cacheKey) || 'null');

    if (cachedData && Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
      // Use cached data if it's less than 5 minutes old
      setFlights(cachedData.flights);
      return;
    }

    if (!originIata || !destinationIata || !departureDate) {
      setError('Please provide valid origin, destination, and departure date.');
      return;
    }
    if (new Date(departureDate) <= new Date()) {
      setError('Departure date must be a future date.');
      return;
    }

    try {
      const searchOptions = {
        method: 'GET',
        url: `https://sky-scanner3.p.rapidapi.com/google/flights/search-one-way`,
        params: {
          departureId: originIata, // Use the origin IATA code
          arrivalId: destinationIata, // Use the destination IATA code
          departureDate, // Use the departure date
        },
        headers: {
          'X-RapidAPI-Key': import.meta.env.VITE_RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'sky-scanner3.p.rapidapi.com',
        },
      };

      const searchResponse = await axios.request(searchOptions);

      if (searchResponse.data && searchResponse.data.data) {
        const { topFlights, otherFlights } = searchResponse.data.data;

        // Combine topFlights and otherFlights into a single array
        const allFlights = [...(topFlights || []), ...(otherFlights || [])];

        setFlights(allFlights);

        // Cache the data
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ flights: allFlights, timestamp: Date.now() })
        );
      } else {
        setFlights([]);
        setError('No flights found for the given criteria.');
      }
    } catch (error) {
      console.error('Error searching for flights:', error);
      setFlights([]);
      setError('Failed to search for flights. Please try again later.');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Search Flights</h1>
      <div className="mb-4">
        <p>
          <strong>Destination City:</strong> {destinationCity || 'Fetching...'}
        </p>
        <p>
          <strong>Destination IATA Code:</strong> {destinationIata || 'Fetching...'}
        </p>
      </div>
      <input
        type="text"
        placeholder="Origin City (e.g. Delhi)"
        value={originCity}
        onChange={(e) => setOriginCity(e.target.value)}
        className="border p-2 mr-2"
      />
      <input
        type="date"
        value={departureDate}
        onChange={(e) => setDepartureDate(e.target.value)}
        className="border p-2 mr-2"
      />
      <button onClick={searchFlights} className="bg-blue-500 text-white px-4 py-2 rounded">
        Search
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {flights.slice(0, 10).map((flight: any, index: number) => (
          <div key={index} className="border rounded-lg p-4 shadow hover:shadow-lg transition">
            <h2 className="text-lg font-bold mb-2">Flight {index + 1}</h2>
            <p>
              <strong>Price:</strong> ₹{flight.price ? (flight.price * exchangeRate).toFixed(2) : 'N/A'}
            </p>
            <p>
              <strong>Airline:</strong>{' '}
              {flight.airline && flight.airline.length > 0
                ? flight.airline.map((airline: any) => airline.airlineName).join(', ')
                : 'Not Available'}
            </p>
            <p>
              <strong>Departure:</strong> {flight.departureTime || 'N/A'}
            </p>
            <p>
              <strong>Arrival:</strong> {flight.arrivalTime || 'N/A'}
            </p>
            {flight.airline && flight.airline[0]?.link && (
              <p>
                <a
                  href={flight.airline[0].link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  Visit Airline Website
                </a>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Transport;
