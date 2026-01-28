/**
 * Checks if two sets are equal (contain the same elements)
 */
export function sets_eq<T>(set1: Set<T>, set2: Set<T>): boolean {
	if (set1.size !== set2.size) {
		return false;
	}
	for (let item of set1) {
		if (!set2.has(item)) {
			return false;
		}
	}
	return true;
}

/**
 * Returns the union of two sets (all elements from both sets)
 */
export function union<T>(set1: Set<T>, set2: Set<T>): Set<T> {
	return new Set([...set1, ...set2]);
}

/**
 * Returns the intersection of two sets (elements present in both sets)
 */
export function intersection<T>(set1: Set<T>, set2: Set<T>): Set<T> {
	const result = new Set<T>();
	for (let item of set1) {
		if (set2.has(item)) {
			result.add(item);
		}
	}
	return result;
}

/**
 * Returns the difference of two sets (elements in set1 but not in set2)
 */
export function difference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
	const result = new Set<T>();
	for (let item of set1) {
		if (!set2.has(item)) {
			result.add(item);
		}
	}
	return result;
}
