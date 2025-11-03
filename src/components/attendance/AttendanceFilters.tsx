import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface AttendanceFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
}

export interface FilterValues {
  startDate?: Date;
  endDate?: Date;
  class?: string;
  department?: string;
  institute?: string;
}

export function AttendanceFilters({ onFilterChange }: AttendanceFiltersProps) {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [classFilter, setClassFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [instituteFilter, setInstituteFilter] = useState<string>('');

  const handleApplyFilters = () => {
    onFilterChange({
      startDate,
      endDate,
      class: classFilter || undefined,
      department: departmentFilter || undefined,
      institute: instituteFilter || undefined,
    });
  };

  const handleReset = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setClassFilter('');
    setDepartmentFilter('');
    setInstituteFilter('');
    onFilterChange({});
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => startDate ? date < startDate : false}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Class Filter */}
          <div className="space-y-2">
            <Label htmlFor="class">Class</Label>
            <Input
              id="class"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              placeholder="e.g., CS-A"
            />
          </div>

          {/* Department Filter - Only for institute admins and super admins */}
          {(profile?.role === 'institute_admin' || profile?.role === 'super_admin') && (
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                placeholder="e.g., Computer Science"
              />
            </div>
          )}

          {/* Institute Filter - Only for super admins */}
          {profile?.role === 'super_admin' && (
            <div className="space-y-2">
              <Label htmlFor="institute">Institute</Label>
              <Input
                id="institute"
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
                placeholder="e.g., ABC University"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleApplyFilters} className="flex-1">
            Apply Filters
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}