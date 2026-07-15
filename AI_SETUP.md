# AI-Powered Road Trip Planner Setup

## OpenAI API Configuration

To use the AI-powered features, you need to set up an OpenAI API key:

1. **Get an OpenAI API Key:**
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Sign up or log in to your account
   - Create a new API key

2. **Configure the API Key:**
   - Create a `.env.local` file in the root directory
   - Add your API key:
   ```
   NEXT_PUBLIC_OPENAI_API_KEY=your_actual_api_key_here
   ```

3. **Restart the Development Server:**
   ```bash
   npm run dev
   ```

## Features

### AI-Powered Trip Planning
- **Intelligent Route Optimization:** AI suggests the best route with interesting stops
- **Priority Area Detection:** Automatically identifies areas worth spending more time
- **Attraction Suggestions:** Recommends attractions based on your preferences
- **Day-by-Day Planning:** Breaks down your trip into balanced daily itineraries
- **Cost Estimation:** Provides budget estimates for your trip

### Example Use Cases
- **Chicago to Yellowstone (10 days):** AI will suggest spending 2 days driving to Yellowstone, 6 days exploring Yellowstone and surrounding areas, and 2 days driving back
- **Route Optimization:** If going from Chicago to Yellowstone, AI will suggest stops like Badlands National Park along the way
- **Priority Areas:** AI identifies areas with high attraction density and suggests spending more time there

### How It Works
1. Enter your trip details (start, end, duration, preferences)
2. Enable AI-powered planning
3. Click "Generate AI-Optimized Trip Plan"
4. AI will create a detailed day-by-day itinerary with:
   - Suggested attractions and stops
   - Driving distances and times
   - Accommodation recommendations
   - Priority areas to explore
   - Cost estimates

## Troubleshooting

### API Key Issues
- Make sure your `.env.local` file is in the root directory
- Verify the API key is correct and has sufficient credits
- Restart the development server after adding the API key

### AI Generation Fails
- Check your internet connection
- Verify your OpenAI API key has sufficient credits
- Try reducing the trip duration or simplifying the route

## Cost Considerations
- OpenAI API calls cost money (typically $0.01-$0.10 per request)
- Each AI plan generation uses approximately 2000-4000 tokens
- Monitor your OpenAI usage at: https://platform.openai.com/usage 