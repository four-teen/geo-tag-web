import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

export async function login(body) {
    const data = {
      username: body.username,
      password: body.password,
    };
  
    const response =  await axios
      .post(buildApiUrl("/admin/login"), data, {
        headers: {
          "Content-Type": "application/json",
        },
      })


      return response
    
  }

export async function logout() {
  const token = Cookies.get("accessToken");
  return axios.post(
    buildApiUrl("/admin/logout"),
    {},
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

export async function changePassword(body) {
  const token = Cookies.get("accessToken");
  return axios.patch(
    buildApiUrl("/admin/account/change-password"),
    {
      current_password: body.current_password,
      password: body.password,
      password_confirmation: body.password_confirmation,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    }
  );
}
