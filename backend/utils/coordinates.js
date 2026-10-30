// Keep coordinate validation consistent across booking and map endpoints.
function validCoordinates(lat, lng) {
  return [lat, lng].every(v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v)))
    && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
module.exports = { validCoordinates };
