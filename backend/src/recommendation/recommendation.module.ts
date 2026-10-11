import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { SwipeModule } from '../swipe/swipe.module';
import { ChatModule } from '../chat/chat.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [SwipeModule, ChatModule, MatchesModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
