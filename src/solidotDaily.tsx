import { useState, useEffect, useCallback } from "react";
import { List, ActionPanel, Action, showToast, Toast, LocalStorage, Detail } from "@raycast/api";
import Parser from "rss-parser";
import { useSolidotSummary, SolidotItem } from "./hooks/useSolidotSummary";

interface DailySummary {
  date: string;
  summary: string;
  newsCount: number;
  generated: string; // ISO timestamp when generated
}

interface GroupedNews {
  [date: string]: SolidotItem[];
}

const STORAGE_KEY = "solidot_daily_summaries";
const RSS_URL = "https://www.solidot.org/index.rss";
const MAX_SUMMARIES = 15;

export default function SolidotDaily() {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const { generateSummary, isGenerating: isSummaryGenerating } = useSolidotSummary();

  // Load existing summaries from storage
  const loadSummaries = useCallback(async () => {
    try {
      const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
      if (stored) {
        const parsedSummaries: DailySummary[] = JSON.parse(stored);
        setSummaries(parsedSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
    } catch (error) {
      console.error("Failed to load summaries:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save summaries to storage
  const saveSummaries = useCallback(async (newSummaries: DailySummary[]) => {
    try {
      // Keep only the latest 15 summaries
      const trimmedSummaries = newSummaries
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, MAX_SUMMARIES);

      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedSummaries));
      setSummaries(trimmedSummaries);
    } catch (error) {
      console.error("Failed to save summaries:", error);
    }
  }, []);

  // Parse RSS and group by date
  const parseRSSAndGroup = useCallback(async (): Promise<GroupedNews> => {
    const parser = new Parser();
    const feed = await parser.parseURL(RSS_URL);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fifteenDaysAgo = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);

    const grouped: GroupedNews = {};

    feed.items.forEach(item => {
      const pubDate = new Date(item.pubDate || item.isoDate || "");
      const dateKey = pubDate.toISOString().split("T")[0]; // YYYY-MM-DD format

      // Only include items from the last 15 days (excluding today)
      if (pubDate >= fifteenDaysAgo && pubDate < today) {
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }

        grouped[dateKey].push({
          title: item.title || "",
          link: item.link || "",
          pubDate: item.pubDate || "",
          isoDate: item.isoDate || "",
          content: item.content || "",
          contentSnippet: item.contentSnippet || "",
        });
      }
    });

    return grouped;
  }, []);

  // Generate summary for a specific date using the custom hook
  const generateSummaryForDate = useCallback(
    async (date: string, newsItems: SolidotItem[]) => {
      return await generateSummary(date, newsItems);
    },
    [generateSummary]
  );

  // Check and generate missing summaries
  const checkAndGenerateMissingSummaries = useCallback(async () => {
    if (isGenerating || isSummaryGenerating) return;

    setIsGenerating(true);

    try {
      const groupedNews = await parseRSSAndGroup();
      const existingSummaryDates = new Set(summaries.map(s => s.date));
      const newSummaries: DailySummary[] = [...summaries];

      // Check each date and generate summary if missing
      for (const [date, newsItems] of Object.entries(groupedNews)) {
        if (!existingSummaryDates.has(date) && newsItems.length > 0) {
          await showToast({
            style: Toast.Style.Animated,
            title: "Generating summary...",
            message: `Generating news summary for ${date}`,
          });

          try {
            const summary = await generateSummaryForDate(date, newsItems);

            newSummaries.push({
              date,
              summary,
              newsCount: newsItems.length,
              generated: new Date().toISOString(),
            });

            await showToast({
              style: Toast.Style.Success,
              title: "Summary generation completed",
              message: `News summary for ${date} has been generated (${newsItems.length} news items)`,
            });
          } catch (error) {
            console.error(`Failed to generate summary for ${date}:`, error);
            await showToast({
              style: Toast.Style.Failure,
              title: "Generation failed",
              message: `Unable to generate summary for ${date}`,
            });
          }
        }
      }

      if (newSummaries.length > summaries.length) {
        await saveSummaries(newSummaries);
      } else {
        await showToast({
          style: Toast.Style.Success,
          title: "Check completed",
          message: "All summaries are up to date",
        });
      }
    } catch (error) {
      console.error("Failed to check and generate summaries:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Check failed",
        message: "Unable to check or generate summaries",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [summaries, parseRSSAndGroup, generateSummaryForDate, saveSummaries, isGenerating, isSummaryGenerating]);

  // Force regenerate a specific summary
  const regenerateSummary = useCallback(
    async (date: string) => {
      if (isGenerating || isSummaryGenerating) return;

      setIsGenerating(true);

      try {
        const groupedNews = await parseRSSAndGroup();
        const newsItems = groupedNews[date];

        if (!newsItems || newsItems.length === 0) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Regeneration failed",
            message: `No news data found for ${date}`,
          });
          return;
        }

        await showToast({
          style: Toast.Style.Animated,
          title: "Regenerating...",
          message: `Regenerating summary for ${date}`,
        });

        const summary = await generateSummaryForDate(date, newsItems);

        const updatedSummaries = summaries.map(s =>
          s.date === date ? { ...s, summary, newsCount: newsItems.length, generated: new Date().toISOString() } : s
        );

        await saveSummaries(updatedSummaries);

        await showToast({
          style: Toast.Style.Success,
          title: "Regeneration completed",
          message: `Summary for ${date} has been updated`,
        });
      } catch (error) {
        console.error(`Failed to regenerate summary for ${date}:`, error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Regeneration failed",
          message: `Unable to regenerate summary for ${date}`,
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [summaries, parseRSSAndGroup, generateSummaryForDate, saveSummaries, isGenerating, isSummaryGenerating]
  );

  // Delete a specific summary
  const deleteSummary = useCallback(
    async (date: string) => {
      const updatedSummaries = summaries.filter(s => s.date !== date);
      await saveSummaries(updatedSummaries);

      await showToast({
        style: Toast.Style.Success,
        title: "Delete successful",
        message: `Summary for ${date} has been deleted`,
      });
    },
    [summaries, saveSummaries]
  );

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  if (isLoading) {
    return <List isLoading={true} />;
  }

  return (
    <List
      isLoading={isGenerating || isSummaryGenerating}
      searchBarPlaceholder="Search date or content..."
      actions={
        <ActionPanel>
          <Action
            title="Check and generate missing summaries"
            onAction={checkAndGenerateMissingSummaries}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
        </ActionPanel>
      }
    >
      {summaries.length === 0 ? (
        <List.EmptyView
          title="No summaries"
          description="Click ⌘R to check and generate news summaries for the last 15 days"
          actions={
            <ActionPanel>
              <Action title="Check and generate missing summaries" onAction={checkAndGenerateMissingSummaries} />
            </ActionPanel>
          }
        />
      ) : (
        summaries.map(summary => (
          <List.Item
            key={summary.date}
            title={summary.date}
            subtitle={`${summary.newsCount} news items`}
            accessories={[{ text: new Date(summary.generated).toLocaleDateString() }]}
            actions={
              <ActionPanel>
                <Action.Push title="View summary" target={<SummaryDetail summary={summary} />} />
                <Action
                  title="Regenerate"
                  onAction={() => regenerateSummary(summary.date)}
                  shortcut={{ modifiers: ["cmd"], key: "g" }}
                />
                <Action
                  title="Delete"
                  onAction={() => deleteSummary(summary.date)}
                  shortcut={{ modifiers: ["cmd"], key: "d" }}
                  style={Action.Style.Destructive}
                />
                <Action
                  title="Check and generate missing summaries"
                  onAction={checkAndGenerateMissingSummaries}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

function SummaryDetail({ summary }: { summary: DailySummary }) {
  return (
    <Detail
      markdown={summary.summary}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Date" text={summary.date} />
          <Detail.Metadata.Label title="News count" text={`${summary.newsCount} items`} />
          <Detail.Metadata.Label title="Generated time" text={new Date(summary.generated).toLocaleString()} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Link title="Visit Solidot" target="https://www.solidot.org" text="solidot.org" />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy summary" content={summary.summary} />
          <Action.OpenInBrowser title="Visit Solidot" url="https://www.solidot.org" />
        </ActionPanel>
      }
    />
  );
}
