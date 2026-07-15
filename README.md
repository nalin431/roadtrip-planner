# 🤖 AI-Powered Road Trip Planner

An intelligent road trip planning app that uses AI to create optimized itineraries with smart attraction suggestions and day-by-day planning. Built with Next.js, Tailwind CSS, OpenAI GPT-4, and Google Maps API.

## Features

- **🤖 AI-Powered Planning**: Intelligent trip optimization using GPT-4
- **Smart Day Breakdown**: AI automatically breaks trips into balanced daily plans
- **Priority Area Detection**: Identifies areas worth spending more time
- **Attraction Suggestions**: AI recommends interesting stops based on your preferences
- **Interactive Google Maps**: Real-time mapping with route visualization
- **Multi-Stop Planning**: Add waypoints and optimize your route
- **Cost Estimation**: AI provides budget estimates for your trip
- **Accommodation Recommendations**: Smart suggestions for places to stay

## Getting Started

### Prerequisites

- Node.js 18+ 
- Google Maps API Key
- OpenAI API Key (for AI features)

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
   - Add your API keys:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Get API Keys:
   - **Google Maps API Key:**
     - Go to [Google Cloud Console](https://console.cloud.google.com/)
     - Create a new project or select an existing one
     - Enable the following APIs:
       - Maps JavaScript API
       - Places API
       - Directions API
     - Create credentials (API Key)
   - **OpenAI API Key:**
     - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
     - Sign up or log in to your account
     - Create a new API key
   - Add both API keys to your `.env.local` file

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Enter Trip Details**: 
   - Input your starting point and destination
   - Set trip duration and preferences
   - Enable AI-powered planning
   - Click "Plan Multi-Stop Trip"

2. **Generate AI Plan**: 
   - Click "Generate AI-Optimized Trip Plan"
   - AI will create a detailed day-by-day itinerary
   - View suggested attractions and priority areas

3. **Explore Your Trip**: 
   - View the optimized route on the map
   - See daily breakdowns with attractions
   - Check accommodation recommendations
   - Review cost estimates

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4 API
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
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

## AI Setup

For detailed AI setup instructions, see [AI_SETUP.md](AI_SETUP.md).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
