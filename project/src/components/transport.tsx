import React, { useState } from 'react';
import axios from 'axios';

const Transport = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('MAA'); // Default example: Chennai
  const [departureDate, setDepartureDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [error, setError] = useState('');

  const exchangeRate = 82; // Example exchange rate: 1 USD = 82 INR

  const searchFlights = async () => {
    const cacheKey = `${origin}-${destination}-${departureDate}`;
    const cachedData = JSON.parse(localStorage.getItem(cacheKey) || 'null');

    if (cachedData && Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
      // Use cached data if it's less than 5 minutes old
      setFlights(cachedData.flights);
      return;
    }

    if (!origin || !destination || !departureDate) {
      setError('Please provide valid origin, destination, and departure date.');
      return;
    }
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
      setError('Origin and destination must be valid IATA codes.');
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
          departureId: origin, // Use the origin IATA code
          arrivalId: destination, // Use the destination IATA code
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
      <input
        type="text"
        placeholder="Origin IATA (e.g. DEL)"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        className="border p-2 mr-2"
      />
      <input
        type="text"
        placeholder="Destination IATA (e.g. MAA)"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
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
