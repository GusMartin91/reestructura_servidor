import dotenv from 'dotenv';
dotenv.config();

const config = {
    PASSWORD: process.env.PASSWORD,
    DB_NAME: process.env.DB_NAME,
    PORT: process.env.PORT
};

export default config;
