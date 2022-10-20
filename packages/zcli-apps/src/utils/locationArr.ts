export const locationArr = (location: string) => {
    // Convert string to array and remove whitespace
	const trimmed = location.split(",").map((locationItem) => {
		const trimmedLocation = locationItem.trim();
		return trimmedLocation;
	});
    // Remove duplicates
	const locationArr = [...new Set(trimmed)];
	return locationArr;
};
