export const isEmpty = (value: string | number | object | unknown): boolean => {
  if (value == null) {
    return true;
  } else if (value == undefined || value == "undefined") {
    return true;
  } else if (typeof value == "string" && value == "") {
    return true;
  } else if (typeof value == "object" && Object.keys(value).length == 0) {
    return true;
  } else {
    return false;
  }
};

const isObject = (value: unknown): boolean => {
  if (typeof value == "object") {
    return true;
  } else {
    return false;
  }
};

export const assignorDefaultValue = (value: any, defaultValue: any) => {
  return isEmpty(value) ? defaultValue : value;
};

export const toBoolean = (value: any) => {
  return value == "true" ? true : false;
};
