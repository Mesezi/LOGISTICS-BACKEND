import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { RidersService } from './riders.service.js';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateRiderDto } from './dto/create-rider.dto.js';
import { ListRidersDto } from './dto/list-riders.dto.js';

@Controller('riders')
export class RidersController {
  constructor(private readonly riders: RidersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRidersDto,
  ) {
    return this.riders.list(user, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.riders.findOne(id, user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRiderDto,
  ) {
    return this.riders.create(user, body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Partial<CreateRiderDto> & { active?: boolean },
  ) {
    return this.riders.update(id, user, body);
  }
}
