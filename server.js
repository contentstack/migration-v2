const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const PORT = 5000;

try {
  const app = express();
  app.use(
    helmet({
      crossOriginOpenerPolicy: false,
    })
  );

  app.use(cors({ origin: "*" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(express.json({ limit: "10mb" }));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "OPTIONS, GET, POST, PUT, PATCH, DELETE"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Allow-Credentials", true);
    next();
  });

  app.use("/", (req, res) => {
    res.status(200).json("Welcome to Migration APIs");
  });

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ message: "Something went wrong!" });
  });

  app.listen(PORT, () => {
    console.info(`Server listening at port ${PORT}`);
  });
} catch (e) {
  console.error("Error while starting the server!");
  console.error(e);
}
