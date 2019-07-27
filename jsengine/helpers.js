module.exports = function () {
  var $model = this;
  return {
    selected: function ($key, value) {
      return $model[$key] == value
        ? `value="${value}" selected="selected"`
        : `value="${value}"`;
    }
  };
};
