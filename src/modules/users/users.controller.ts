import {
  Controller,
  Get,
  Body,
  Param,
  Post,} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user.dto';
import { CreateUserDto } from './dto/auth.dto';


@Controller('users')
@ApiTags('Users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('create')
  @ApiOperation({ summary: 'Create a new user with name and password' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create({
     ...dto
    });
   
    return user;
  }


  @Get('/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserResponseDto,
  })
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }


  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async listUsers() {
    return this.usersService.findAll();
  }
}
