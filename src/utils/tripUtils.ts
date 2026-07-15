import { DayPlan, Attraction, Accommodation } from '@/types/trip';

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};



export const getAttractionIcon = (type: string): string => {
  switch (type) {
    case 'hiking':
      return '🥾';
    case 'scenic':
      return '🏔️';
    case 'cultural':
      return '🏛️';
    case 'food':
      return '🍽️';
    case 'entertainment':
      return '🎡';
    default:
      return '📍';
  }
};

export const getAccommodationIcon = (type: string): string => {
  switch (type) {
    case 'hotel':
      return '🏨';
    case 'motel':
      return '🚗';
    case 'hostel':
      return '🏠';
    case 'campground':
      return '🏕️';
    case 'bnb':
      return '🏡';
    default:
      return '🛏️';
  }
};

export const calculateTotalCost = (dayPlans: DayPlan[]): number => {
  const accommodationCost = dayPlans.reduce((sum, day) => {
    return sum + (day.accommodation?.price || 0);
  }, 0);
  
  const attractionCost = dayPlans.reduce((sum, day) => {
    return sum + day.attractions.reduce((daySum, attraction) => {
      return daySum + (attraction.cost || 0);
    }, 0);
  }, 0);

  return accommodationCost + attractionCost;
};

export const calculateFuelCost = (totalDistance: number, mpg: number = 25, pricePerGallon: number = 3.50): number => {
  return (totalDistance / mpg) * pricePerGallon;
};

export const getDayPlanStats = (dayPlans: DayPlan[]) => {
  const totalDistance = dayPlans.reduce((sum, day) => sum + day.totalDistance, 0);
  const totalDuration = dayPlans.reduce((sum, day) => sum + day.totalDuration, 0);
  const totalAttractions = dayPlans.reduce((sum, day) => sum + day.attractions.length, 0);
  const totalAccommodations = dayPlans.filter(day => day.accommodation).length;

  return {
    totalDistance,
    totalDuration,
    totalAttractions,
    totalAccommodations
  };
}; 