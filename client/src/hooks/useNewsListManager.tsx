import { useState } from "react";
import { DATA_ENDPOINTS } from "../constants/api";
import { Article } from "../types";
import { authPost } from "../utils/api";

/**
 * Custom hook to manage the state and fetching logic for the news feed.
 * Handles filtering articles based on selected categories and parsing 
 * different potential response formats from the backend.
 * 
 * @returns {Object} Object containing news state (articles, filter, loading, error) and control functions.
 */
export const useNewsListManager = () => {
      const [newsFilter, setNewsFilter] = useState("All");
      const [articles, setArticles] = useState<Article[]>([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);

      /**
       * Fetches news articles from the backend based on the provided filter string.
       * Handles normalizing the data structure since the API sometimes returns 
       * flat arrays, nested 'articles' arrays, or nested 'feed' arrays.
       * 
       * @param {string} filter - The category or keyword to filter news by (e.g. "All", "Technology").
       */
      const handleFilterChange = async (filter: string) => {
        setNewsFilter(filter);
        setLoading(true);
        setError(null);
        try {
            const data = await authPost<any>(
                DATA_ENDPOINTS.NEWS,
                { filter: filter }
            );
            let extractedArticles: Article[] = [];

            if (Array.isArray(data)) {
                extractedArticles = data;
            } else if (typeof data === "object" && data !== null) {
                // Check for common properties that might contain the articles array
                if (Array.isArray(data.articles)) {
                extractedArticles = data.articles;
                } else if (Array.isArray(data.feed)) {
                extractedArticles = data.feed;
                } else {
                // If we can't find an array, try to create an array from the object
                extractedArticles = [data];
                }
            }
            if (extractedArticles.length > 0) {
                setArticles(extractedArticles);
            } else {
                setError("No articles found");
            }
        } catch (error) {
            console.error("Filter failed:", error);
            setError("Failed to fetch news");
        } finally {
            setLoading(false);
        }
      };

      return {
        newsFilter,
        setNewsFilter,
        articles,
        setArticles,
        handleFilterChange,
        loading,
        error
      }
}