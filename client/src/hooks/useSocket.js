import { useEffect, useState } from "react";
import io from "socket.io-client";

export const useSocket = (url) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(url, {
      transports: ["websocket"],
      upgrade: false,
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [url]);

  return socket;
};
