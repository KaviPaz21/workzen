REQUIRED_CREDITS = 2.5
ALTERNATIVE_CREDITS = 2.0
MAX_GRADE = 4.0
SCORE_PER_GRADE = 100 / MAX_GRADE
MIN_PARTIAL_EXPERIENCE_GRADE = 0.5


def checklist_grade_point(matched: list[bool], alternative_relevance: list[int]) -> float:
    credits = REQUIRED_CREDITS * len(matched) + ALTERNATIVE_CREDITS * len(alternative_relevance)
    if credits == 0:
        return 0.0
    earned = sum(REQUIRED_CREDITS * MAX_GRADE for hit in matched if hit)
    earned += sum(ALTERNATIVE_CREDITS * MAX_GRADE * min(max(value, 0), 100) / 100 for value in alternative_relevance)
    return earned / credits


def experience_grade_point(required_months: int, available_months: int) -> float:
    if required_months <= 0 or available_months >= required_months:
        return MAX_GRADE
    coverage = max(available_months, 0) / required_months
    return MIN_PARTIAL_EXPERIENCE_GRADE + coverage * (MAX_GRADE - MIN_PARTIAL_EXPERIENCE_GRADE)


def grade_point_to_score(grade_point: float) -> int:
    return round(grade_point * SCORE_PER_GRADE)


def weighted_overall_score(grade_points: list[float], weights: list[int]) -> int:
    if not grade_points:
        return 0
    total_weight = sum(weights)
    if total_weight > 0:
        average = sum(point * weight for point, weight in zip(grade_points, weights)) / total_weight
    else:
        average = sum(grade_points) / len(grade_points)
    return grade_point_to_score(average)
