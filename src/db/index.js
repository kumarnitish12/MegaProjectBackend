
import mongoose from "mongoose"
import {DB_NAME} from "../constants.js";


const connectDB = async function(){
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log("Mongod DB connected !!")
    }
    catch(error){
        console.log("MongoDB connection failed", error);
    }
}

export default connectDB