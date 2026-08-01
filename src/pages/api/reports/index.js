import axios from 'axios';
import Cookies from 'js-cookie';
import { buildApiUrl } from '../../../utils/api';

export async function GetVoterReport(params = {}, config = {}) {
  return axios.get(buildApiUrl('/bow/reports/voters'), {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${Cookies.get('accessToken')}`,
    },
    params: {
      ...config.params,
      ...params,
    },
  });
}

export async function GetVoterReportRecords(params = {}, config = {}) {
  return axios.get(buildApiUrl('/bow/reports/voters/records'), {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${Cookies.get('accessToken')}`,
    },
    params: {
      ...config.params,
      ...params,
    },
  });
}
