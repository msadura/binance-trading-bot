function getResponseError(e) {
  if (e.body) {
    return JSON.parse(e.body);
  }

  return null;
}

function logResponseError(error) {
  const responseError = getResponseError(error);
  console.log('🔥 RES ERROR: ', `code: ${responseError.code}`, `message:${responseError.msg}`);
}

module.exports = {
  getResponseError,
  logResponseError
};
