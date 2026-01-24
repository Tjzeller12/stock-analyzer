import { Article } from "../../types";
import { formatDate } from "../../utils/formatters";
import "./NewsListItem.css";

export interface NewsListItemProps {
    article: Article;
}

const NewsListItem = (props: NewsListItemProps) => {

    return (
        <div className="news-list-item">
            <img className="news-header-img" src={props.article.image_link}></img>
            <p className="article-summary"></p>
            <div className="article-meta">
                <div className="article-title">{props.article.title} </div>
                <span className="news-company">{props.article.news_company}</span>
                <span className="time-published">
                {formatDate(props.article.time_published)}
                </span>
            </div>
        </div>
    );
}

export default NewsListItem;