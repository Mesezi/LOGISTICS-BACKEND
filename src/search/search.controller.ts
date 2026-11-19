import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { SearchSuggestionsDto } from './dto/search-suggestions.dto.js';
import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('banks')
  banks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchSuggestionsDto,
  ) {
    return this.search.banks(user, query.q);
  }

  @Get('locations')
  locations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchSuggestionsDto,
  ) {
    return this.search.locations(user, query.q);
  }
}
