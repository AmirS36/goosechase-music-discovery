import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { generateToken } from '../lib/jwt';


const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || user.password !== password) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = generateToken({ userId: user.id, username: user.username });

  res.json({ 
    message: "Login successful",
    token,
    username: user.username
   });
});

export default router;