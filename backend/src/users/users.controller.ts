import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: Request & { user: { id: number; email: string } }) {
    return this.usersService.findById(req.user.id);
  }

  @Get('stats')
  async getStats(@Req() req: Request & { user: { id: number } }) {
    return this.usersService.getStats(req.user.id);
  }

  @Patch('me/resume')
  async updateResume(
    @Req() req: Request & { user: { id: number } },
    @Body('resume') resume: string,
  ) {
    return this.usersService.updateResume(req.user.id, resume);
  }
}
