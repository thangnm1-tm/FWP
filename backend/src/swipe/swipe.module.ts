import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwipeEvent } from './entities/swipe-event.entity';
import { RecommendationImpression } from './entities/recommendation-impression.entity';
import { Match } from '../matches/entities/match.entity';
import { SwipeService } from './swipe.service';
import { SwipeController } from './swipe.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwipeEvent, RecommendationImpression, Match]),
  ],
  controllers: [SwipeController],
  providers: [SwipeService],
  exports: [SwipeService],
})
export class SwipeModule {}
