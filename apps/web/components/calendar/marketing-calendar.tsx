'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CalendarEvent, CalendarEventsByDate } from '@/lib/actions/calendar';

interface MarketingCalendarProps {
  events: CalendarEventsByDate;
  initialMonth?: Date;
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

export function MarketingCalendar({
  events,
  initialMonth = new Date(),
  onEventClick,
  onDateClick,
}: MarketingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return events[dateKey] || [];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'active':
      case 'executing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'planned':
      case 'queued':
      case 'drafting':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Calendar Grid */}
      <Card className="flex-1 p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayIsToday = isToday(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDateClick(day)}
                className={cn(
                  'group relative flex min-h-[80px] flex-col rounded-md border p-1 text-left transition-colors hover:bg-accent',
                  !isCurrentMonth && 'bg-muted/50 text-muted-foreground',
                  isSelected && 'border-primary bg-primary/5',
                  dayIsToday && !isSelected && 'border-primary/50'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-sm',
                    dayIsToday && 'bg-primary text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
                <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      className={cn(
                        'truncate rounded px-1 py-0.5 text-xs cursor-pointer hover:opacity-80',
                        event.type === 'campaign'
                          ? 'bg-primary/10 text-primary'
                          : getStatusColor(event.status)
                      )}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="px-1 text-xs text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Event Details Sidebar */}
      <Card className="w-full p-4 lg:w-80">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Calendar className="h-4 w-4" />
          {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
        </h3>

        {selectedDate && selectedDateEvents.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No events scheduled for this date.
          </p>
        )}

        {selectedDateEvents.length > 0 && (
          <div className="space-y-3">
            {selectedDateEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-start gap-2">
                  {event.type === 'campaign' ? (
                    <Megaphone className="mt-0.5 h-4 w-4 text-primary" />
                  ) : (
                    <CheckSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{event.title}</p>
                    {event.campaignName && event.type === 'task' && (
                      <p className="truncate text-xs text-muted-foreground">
                        {event.campaignName}
                      </p>
                    )}
                    {event.contentType && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {event.contentType.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className={cn('text-xs', getStatusColor(event.status))}>
                    {event.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(event.scheduledAt), 'h:mm a')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
