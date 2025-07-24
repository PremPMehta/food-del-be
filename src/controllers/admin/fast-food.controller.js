const CategoryModel = require("../../models/category.model");
const DishModel = require("../../models/dish.model");


const getfastfood=async(req,res)=>{
 try {
    let fastfood=await CategoryModel.find({type:"fastfood"});

    if(!fastfood){
        return res.status(404).json({ message: "fastfood not found" });
    }
   return res.status(200).json(fastfood);
 } catch (error) {
    res.status(400).json({ error: error.message }); 
 }
}

module.exports={getfastfood}