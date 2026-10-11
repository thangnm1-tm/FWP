import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MatchesService } from './matches.service';

@ApiTags('Matches')
@Controller('matches')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all current matches' })
  async getMatches(@Request() req: any) {
    return this.matchesService.getUserMatches(req.user.id);
  }

  @Post(':matchId/unmatch')
  @ApiOperation({ summary: 'Unmatch a user' })
  async unmatch(@Request() req: any, @Param('matchId') matchId: string) {
    await this.matchesService.unmatch(matchId, req.user.id);
    return { message: 'Unmatched' };
  }
}
