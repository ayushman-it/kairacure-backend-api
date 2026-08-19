import express from 'express';

const router = express.Router();
const FLIGHT_API_KEY = process.env.FLIGHT_API_KEY || '6a84a2d99c48dcc1a75d43ad';

// City Airport Coordinates / Base Rate Fallbacks
const AIRPORT_RATES = {
  DEL: 4500,
  BOM: 6200,
  BLR: 5800,
  MAA: 6000,
  HYD: 5400,
  CCU: 5900,
  JAI: 3200,
  IXC: 3400,
  ATQ: 3800,
  DXB: 18500,
  RUH: 22000,
  DOH: 21000,
  KWI: 23000,
  MCT: 19500,
  BAH: 21500,
  NBO: 38000,
  LOS: 45000,
  DAC: 12000
};

// GET /api/travel/flights?origin=DEL&destination=BOM
router.get('/flights', async (req, res) => {
  try {
    const origin = (req.query.origin || 'DEL').toUpperCase();
    const destination = (req.query.destination || 'BOM').toUpperCase();
    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    let livePrice = null;
    let flightCount = 0;
    let isLive = false;

    // Call FlightAPI.io from backend (bypassing browser CORS)
    if (origin !== destination) {
      try {
        const flightApiUrl = `https://api.flightapi.io/onewaytrip/${FLIGHT_API_KEY}/${origin}/${destination}/${futureDate}/1/0/0/Economy/INR`;
        const response = await fetch(flightApiUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.itineraries && data.itineraries.length > 0) {
            flightCount = data.itineraries.length;
            let minPrice = Infinity;
            data.itineraries.forEach(it => {
              const amt = it.cheapest_price?.amount || it.pricing_options?.[0]?.price?.amount;
              if (amt && amt < minPrice) minPrice = amt;
            });
            if (minPrice < Infinity) {
              livePrice = Math.round(minPrice);
              isLive = true;
            }
          }
        }
      } catch (e) {
        console.log('Backend FlightAPI fetch fallback:', e.message);
      }
    }

    // Fallback price calculation if API is offline or rate-limited
    if (!livePrice) {
      const baseOrigin = AIRPORT_RATES[origin] || 5500;
      const baseDest = AIRPORT_RATES[destination] || 5500;
      livePrice = Math.round((baseOrigin + baseDest) / 2);
      flightCount = 8;
    }

    res.json({
      success: true,
      origin,
      destination,
      departureDate: futureDate,
      livePrice,
      flightCount,
      isLive,
      currency: 'INR'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/travel/hotels?city=Delhi&starCategory=3star
router.get('/hotels', (req, res) => {
  const city = req.query.city || 'New Delhi / NCR';
  const category = req.query.starCategory || '3star';

  const hotelDatabase = {
    'New Delhi / NCR': [
      { name: 'Lemon Tree Premier (Aerocity)', star: '4star', price: 7500, dist: '1.2 km from Hospital', rating: 4.6, amenities: ['Wheelchair Accessible', 'Doctor on Call'] },
      { name: 'Radisson Blu Hotel (Paschim Vihar)', star: '5star', price: 14500, dist: '2.1 km from Hospital', rating: 4.8, amenities: ['24/7 Concierge', 'Oxygen Support'] },
      { name: 'Ginger Hotel (East Delhi)', star: '3star', price: 4200, dist: '0.9 km from Hospital', rating: 4.3, amenities: ['Patient Diet Kitchen', 'Elevator'] },
      { name: 'FabHotel Prime Executive', star: '2star', price: 2600, dist: '0.5 km from Hospital', rating: 4.1, amenities: ['Free Wi-Fi', 'Room Service'] }
    ],
    'Mumbai': [
      { name: 'ITC Grand Central (Parel)', star: '5star', price: 16000, dist: '0.8 km from Hospital', rating: 4.9, amenities: ['Medical Suite', 'Doctor on Call'] },
      { name: 'The Lalit Mumbai (Sahar)', star: '4star', price: 8200, dist: '1.5 km from Hospital', rating: 4.7, amenities: ['Wheelchair Ramp', 'Special Patient Care'] },
      { name: 'Hotel Kohinoor Park (Prabhadevi)', star: '3star', price: 4800, dist: '0.6 km from Hospital', rating: 4.4, amenities: ['Dietary Meals', 'Elevator'] }
    ],
    'Bengaluru': [
      { name: 'Taj Yeshwantpur', star: '5star', price: 15500, dist: '1.1 km from Hospital', rating: 4.8, amenities: ['Wheelchair Care', 'Special Diet'] },
      { name: 'Lemon Tree Hotel (Whitefield)', star: '4star', price: 7800, dist: '0.7 km from Hospital', rating: 4.6, amenities: ['Doctor Escort', 'Silent Rooms'] },
      { name: 'IBIS Bengaluru Hosur Road', star: '3star', price: 4400, dist: '1.3 km from Hospital', rating: 4.3, amenities: ['24/7 Room Service', 'Kitchenette'] }
    ],
    'Chennai': [
      { name: 'Hyatt Regency Chennai', star: '5star', price: 14000, dist: '1.0 km from Hospital', rating: 4.8, amenities: ['Hospital Escort Service', 'Translators'] },
      { name: 'The Residency Towers', star: '4star', price: 7200, dist: '0.5 km from Hospital', rating: 4.6, amenities: ['Wheelchair Friendly', 'Organic Diet'] },
      { name: 'Hotel Savera (Mylapore)', star: '3star', price: 4200, dist: '1.2 km from Hospital', rating: 4.4, amenities: ['Patient Lounge', 'Doctor Call'] }
    ],
    'Hyderabad': [
      { name: 'Park Hyatt Banjara Hills', star: '5star', price: 15000, dist: '0.9 km from Hospital', rating: 4.9, amenities: ['VIP Medical Suite', 'Private Ambulance'] },
      { name: 'Mercure Hyderabad KCP', star: '4star', price: 7600, dist: '0.6 km from Hospital', rating: 4.7, amenities: ['Quiet Floor', 'Patient Meals'] },
      { name: 'Hotel Katriya (Somajiguda)', star: '3star', price: 4500, dist: '0.4 km from Hospital', rating: 4.3, amenities: ['Elevator', '24h Room Service'] }
    ]
  };

  const cityKey = Object.keys(hotelDatabase).find(k => k.toLowerCase().includes(city.toLowerCase())) || 'New Delhi / NCR';
  const cityHotels = hotelDatabase[cityKey] || hotelDatabase['New Delhi / NCR'];
  const filtered = category === 'none' ? cityHotels : cityHotels.filter(h => h.star === category);

  res.json({
    success: true,
    city: cityKey,
    starCategory: category,
    hotels: filtered.length ? filtered : cityHotels.slice(0, 2)
  });
});

export default router;
