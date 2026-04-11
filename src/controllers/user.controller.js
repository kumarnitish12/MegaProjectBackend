import asyncHandler from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import validator from "validator";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import jwt from"jsonwebtoken"


const generateAccessAndRefreshTokens = async (userId) => {
    try {
        

        const user = await User.findById(userId);
       

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        

        const refreshToken = user.generateRefreshToken();
        

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });
        

        return { accessToken, refreshToken };

    } catch (err) {
        console.log("FULL ERROR:", err); // 🔥 THIS IS KEY
        throw new ApiError(500, "Something went wrong");
    }
};


const registerUser = asyncHandler(async (req, res)=>{

    const {fullname, email, username,password} =req.body;
    console.log(fullname, email);

    if([fullname, email, username,password].some((field)=>
    field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required");
    }
    if(!validator.isEmail(email)){
        throw new ApiError(400,"Enter valid Email");
    }
    const existeduser=await User.findOne({
        $or:[{email},{username}]
    })
    if(existeduser){
        throw new ApiError(409,"user with email or username exist");
    }
    const avatarlocalpath = req.files?.avatar?.[0]?.path;
    const coverimagelocalpath = req.files?.coverImage?.[0]?.path;
    if(!avatarlocalpath){
        throw new ApiError(400, "Avatar file is required")
    }
   const avatar= await uploadOnCloudinary(avatarlocalpath);
   const coverimage = await uploadOnCloudinary(coverimagelocalpath);
   if(!avatar){
    throw new ApiError(400,"Avatar file is needed");
   }
   const user =await User.create({
    fullname,
    avatar :avatar.url,
    coverimage : coverimage?.url || "",
    email,
    password,
    username:username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
   )
   if(!createdUser){
    throw new ApiError(500,"Something went wrong")
   }

   return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered")
   )


})

const loginUser = asyncHandler(async (req,res)=>{
    //req body -> data
    //username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie

    const {email, username,password}= req.body
    if(!(username || email)){
        throw new ApiError(400, "username or password is required")
    }

    const user=await User.findOne({
        $or: [{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"user not found")
    }

    const ispasswordValid = await user.isPasswordCorrect(password);
    if(!ispasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    const {accessToken, refreshToken} = await 
    generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options ={
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken,options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,
                refreshToken

            },
            "User logged In succesfully"
        )
    )

})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options={
        httplOnly:true,
        secure:true
    }
    return res
    .status(200)
    .cookie("accessToken", options)
    .cookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

export { registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
 }