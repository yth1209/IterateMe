export interface RequestLog {
  uri: string;
  httpMethod: string;
  queryString: string | undefined;
  controllerMethodArgs: string;
  requestHeader: string;
}

export interface ResponseLog {
  responseBody: string;
  httpStatusCode: number;
}

export interface Duration {
  time: number;
  unit: 'MILLIS';
  readableString: string;
}
