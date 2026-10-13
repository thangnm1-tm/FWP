import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationService } from './recommendation.service';

@ApiTags('Recommendations')
@Controller('recommendations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get()
  @ApiOperation({ summary: 'Get recommended candidates for swipe feed' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecommendations(
    @Request() req: any,
    @Query('limit') limit?: number,
  ) {
    const result = await this.recommendationService.getRecommendations(
      req.user.id,
      limit || 20,
    );

    // Don't expose scores to client
    return {
      requestId: result.requestId,
      candidates: result.candidates.map((c) => ({
        candidateId: c.candidateId,
        rank: c.rank,
        distanceKm: c.distanceKm ? Math.round(c.distanceKm * 10) / 10 : null,
        impressionId: c.impressionId,
        displayName: c.displayName,
        age: c.age,
        bio: c.bio,
        photos: c.photos || [],
        interests: c.interests || [],
        faculty: c.faculty,
        university: c.university,
        gpaBucket: c.gpaBucket,
      })),
    };
  }
}
