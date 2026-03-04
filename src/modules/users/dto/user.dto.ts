import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User name',
    example: 'Jean Dupont',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'User email (optional)',
    example: 'jean@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'User password (optional)',
    example: 'password123',
    required: false,
  })
  @IsOptional()
  @IsString()
  passwordHash?: string;
}

export class UserResponseDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  createdAt!: Date
  @ApiProperty()
  updatedAt!: Date;
}
