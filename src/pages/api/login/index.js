import axios from "axios";
import Cookies from "js-cookie";

export async function login(body) {
    const data = {
      username: body.username,
      password: body.password,
    };
  
    const response =  await axios
      .post(`${process.env.NEXT_PUBLIC_API_URL}/admin/login`, data, {
        headers: {
          "Content-Type": "application/json",
        },
      })


      return response
    
  }

export async function logout() {
  const token = Cookies.get("accessToken");
  return axios.post(
    `${process.env.NEXT_PUBLIC_API_URL}/admin/logout`,
    {},
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
