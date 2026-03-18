function toIsoTimestamp(value = new Date()) {
  return new Date(value).toISOString();
}

function toDisplayDate(value) {
  return new Date(value).toLocaleString();
}

module.exports = {
  toIsoTimestamp,
  toDisplayDate
};
