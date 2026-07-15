import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface AIAttraction {
  name: string;
  location: string;
  type: 'hiking' | 'scenic' | 'cultural' | 'food' | 'entertainment';
  description: string;
  estimatedDuration: number; // in minutes
  priority: 'high' | 'medium' | 'low';
  cost?: number;
}

export interface AIDayPlan {
  day: number;
  focus: string;
  drivingDistance: number;
  drivingDuration: number;
  attractions: AIAttraction[];
  accommodation?: {
    name: string;
    type: string;
    location: string;
    price?: number;
  };
  notes: string;
}

export interface AITripPlan {
  totalDays: number;
  dayPlans: AIDayPlan[];
  suggestedStops: string[];
  priorityAreas: string[];
  totalDistance: number;
  totalCost?: number;
}

export async function generateAITripPlan(
  startPoint: string,
  endPoint: string,
  totalDays: number,
  stops: string[],
  preferences: {
    maxDrivingHoursPerDay: number;
    preferredAttractionTypes: string[];
    budget?: number;
    isReturnTrip: boolean;
  }
): Promise<AITripPlan> {
  try {
    const prompt = `
You are an expert road trip planner. Create a detailed ${totalDays}-day road trip plan from ${startPoint} to ${endPoint}${preferences.isReturnTrip ? ' and back' : ''}.

Requirements:
- Total trip duration: ${totalDays} days
- Maximum driving hours per day: ${preferences.maxDrivingHoursPerDay} hours
- Preferred attraction types: ${preferences.preferredAttractionTypes.join(', ')}
- ${preferences.budget ? `Budget: $${preferences.budget}` : 'No specific budget'}
- ${stops.length > 0 ? `Must include these stops: ${stops.join(', ')}` : 'No specific stops required'}

Please prioritize areas with the most interesting attractions and natural beauty. For example, if going from Chicago to Yellowstone, prioritize spending more time at Yellowstone and include stops at places like Badlands National Park.

Break down the trip into days with:
1. Day-by-day itinerary
2. Driving distances and times
3. Recommended attractions at each stop
4. Accommodation suggestions
5. Priority areas to spend more time
6. Suggested additional stops along the route

Focus on creating a balanced trip with:
- More time spent in areas with high attraction density (like national parks)
- Efficient driving routes between major destinations
- Interesting stops along the way
- Realistic daily driving distances

Return the response as a JSON object with this structure:
{
  "totalDays": number,
  "dayPlans": [
    {
      "day": number,
      "focus": "string describing the day's focus",
      "drivingDistance": number in miles,
      "drivingDuration": number in minutes,
      "attractions": [
        {
          "name": "string",
          "location": "string",
          "type": "hiking|scenic|cultural|food|entertainment",
          "description": "string",
          "estimatedDuration": number in minutes,
          "priority": "high|medium|low",
          "cost": number (optional)
        }
      ],
      "accommodation": {
        "name": "string",
        "type": "string",
        "location": "string",
        "price": number (optional)
      },
      "notes": "string with additional tips"
    }
  ],
  "suggestedStops": ["array of additional stop suggestions"],
  "priorityAreas": ["areas where more time should be spent"],
  "totalDistance": number in miles,
  "totalCost": number (optional)
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert road trip planner with deep knowledge of US geography, attractions, and travel planning. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from AI');
    }

    // Try to parse the JSON response
    try {
      const aiPlan = JSON.parse(response);
      return aiPlan as AITripPlan;
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      throw new Error('Invalid AI response format');
    }
  } catch (error) {
    console.error('Error generating AI trip plan:', error);
    throw error;
  }
}

export async function generateAttractionsForLocation(
  location: string,
  preferredTypes: string[],
  maxDuration: number = 240 // 4 hours default
): Promise<AIAttraction[]> {
  try {
    const prompt = `
Find the most interesting attractions near ${location}. Focus on ${preferredTypes.join(', ')} type attractions.

Requirements:
- Location: ${location}
- Preferred types: ${preferredTypes.join(', ')}
- Maximum total duration: ${maxDuration} minutes
- Include only real, notable attractions

Return as JSON array:
[
  {
    "name": "string",
    "location": "string",
    "type": "hiking|scenic|cultural|food|entertainment",
    "description": "string",
    "estimatedDuration": number in minutes,
    "priority": "high|medium|low",
    "cost": number (optional)
  }
]
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert travel guide. Provide accurate, real attractions. Always respond with valid JSON arrays."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 2000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from AI');
    }

    try {
      const attractions = JSON.parse(response);
      return attractions as AIAttraction[];
    } catch (parseError) {
      console.error('Failed to parse attractions response:', response);
      throw new Error('Invalid attractions response format');
    }
  } catch (error) {
    console.error('Error generating attractions:', error);
    throw error;
  }
} 