# 🗺️ Roadtrip Planner

A lightweight roadtrip planning app specifically designed for sightseeing and camping enthusiasts. Built with Next.js, Tailwind CSS, and Google Maps API.

## Features

- **Interactive Google Maps**: Real-time mapping with route visualization
- **Start & Destination Input**: Easy input for trip planning
- **Sightseeing Spots**: Automatically finds tourist attractions along your route
- **Camping Locations**: Discovers camping sites near your route
- **Route Optimization**: Calculates optimal driving routes
- **Lightweight Design**: Fast, responsive, and user-friendly interface

## Getting Started

### Prerequisites

- Node.js 18+ 
- Google Maps API Key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd roadtrip-planner
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Create a `.env.local` file in the root directory
   - Add your Google Maps API key:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

4. Get a Google Maps API Key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the following APIs:
     - Maps JavaScript API
     - Places API
     - Directions API
   - Create credentials (API Key)
   - Add the API key to your `.env.local` file

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Enter Trip Details**: 
   - Input your starting point
   - Input your destination
   - Click "Plan Trip"

2. **View Route**: 
   - The map will display the optimal route
   - Green markers show camping sites
   - Red markers show tourist attractions

3. **Explore POIs**: 
   - Click on markers for detailed information
   - Plan your stops based on the discovered locations

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Google Maps JavaScript API
- **POIs**: Google Places API

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main page component
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
└── components/
    ├── MapComponent.tsx   # Google Maps integration
    ├── TripForm.tsx      # Trip input form
    └── TripInfo.tsx      # Route information display
```

## Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
