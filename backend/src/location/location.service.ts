import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserLocation } from './entities/user-location.entity';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(UserLocation)
    private readonly locationRepository: Repository<UserLocation>,
    private readonly dataSource: DataSource,
  ) {}

  async updateLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<UserLocation> {
    const rows = await this.dataSource.query(
      `INSERT INTO user_locations (user_id, latitude, longitude, point)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)
       ON CONFLICT (user_id) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         point = EXCLUDED.point,
         updated_at = NOW()
       RETURNING id, user_id AS "userId", latitude, longitude, updated_at AS "updatedAt"`,
      [userId, latitude, longitude],
    );
    return this.locationRepository.create(rows[0] as Partial<UserLocation>);
  }

  /**
   * Calculate distance in km between two users using PostGIS
   */
  async getDistanceKm(userIdA: string, userIdB: string): Promise<number | null> {
    const result = await this.dataSource.query(
      `SELECT ST_Distance(a.point, b.point) / 1000.0 AS distance_km
       FROM user_locations a, user_locations b
       WHERE a.user_id = $1 AND b.user_id = $2`,
      [userIdA, userIdB],
    );

    if (result.length === 0) return null;
    return parseFloat(result[0].distance_km);
  }

  /**
   * Find users within radius (km) — used by candidate generation
   */
  async findUsersWithinRadius(
    userId: string,
    radiusKm: number,
  ): Promise<{ userId: string; distanceKm: number }[]> {
    const radiusMeters = radiusKm * 1000;

    const result = await this.dataSource.query(
      `SELECT b.user_id AS "userId",
              ST_Distance(a.point, b.point) / 1000.0 AS "distanceKm"
       FROM user_locations a, user_locations b
       WHERE a.user_id = $1
         AND b.user_id != $1
         AND ST_DWithin(a.point, b.point, $2)
       ORDER BY ST_Distance(a.point, b.point)`,
      [userId, radiusMeters],
    );

    return result;
  }
}
