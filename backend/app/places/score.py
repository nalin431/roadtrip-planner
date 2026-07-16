"""fun_score = w1*normalize(rating) + w2*normalize(log(review_count)) + w3*categoryBoost(category)
Simple and documented rather than clever. Ported from the Go version's
identical formula/weights.
"""

import math

_W_RATING = 0.6
_W_REVIEWS = 0.3
_W_CATEGORY = 0.1

_CATEGORY_BOOSTS = {
    "tourist_attraction": 1.0,
    "natural_feature": 1.0,
    "park": 0.8,
    "museum": 0.7,
    "restaurant": 0.5,
    "cafe": 0.4,
}


def fun_score(rating: float, user_ratings_total: int, category: str) -> float:
    normalized_rating = rating / 5.0  # Google ratings are 0-5
    normalized_reviews = min(math.log10(user_ratings_total + 1) / 4.0, 1.0)
    category_boost = _CATEGORY_BOOSTS.get(category, 0.0)

    return _W_RATING * normalized_rating + _W_REVIEWS * normalized_reviews + _W_CATEGORY * category_boost
